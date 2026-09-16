using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Pegasus.Agent.Core;

public sealed class HttpsGatewayClient : IAgentGatewayClient
{
    private readonly HttpClient http;
    private const string AgentVersion = "0.1.0-a4a";

    public HttpsGatewayClient(HttpClient? client = null) => http = client ?? new HttpClient { Timeout = TimeSpan.FromSeconds(20) };

    public async Task<AgentIdentity> CompletePairingAsync(PairingCode pairingCode, string gatewayUrl, CancellationToken cancellationToken)
    {
        var (privateKey, publicKey, keyId) = AgentSigner.CreateIdentity();
        var nonce = CanonicalJson.RandomToken();
        var tokenHash = CanonicalJson.Sha256Base64Url(pairingCode.Token);
        var proof = string.Join('\n', "PEGASUS-PAIRING-V1", pairingCode.ChallengeId, tokenHash, nonce);
        var body = new JsonObject
        {
            ["challengeId"] = pairingCode.ChallengeId,
            ["token"] = pairingCode.Token,
            ["keyId"] = keyId,
            ["publicKey"] = publicKey,
            ["registrationNonce"] = nonce,
            ["registrationSignature"] = AgentSigner.Sign(privateKey, proof),
        };
        var response = await SendAsync(HttpMethod.Post, gatewayUrl, "/api/device/pairing/complete", body, null, cancellationToken);
        var root = await ReadJsonAsync(response, cancellationToken);
        var deviceId = root["deviceId"]?.GetValue<string>() ?? throw new GatewayRejectedException("PAIRING_RESPONSE_INVALID");
        return new AgentIdentity(deviceId, keyId, privateKey, publicKey, NormalizeGateway(gatewayUrl), new[] { "filesystem.list" }, DateTimeOffset.UtcNow);
    }

    public async Task<int> HeartbeatAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        var announced = identity.GrantedCapabilities.Select(capability => (JsonNode?)JsonValue.Create(capability)).ToArray();
        var body = new JsonObject { ["agentVersion"] = AgentVersion, ["operatingSystem"] = Environment.OSVersion.VersionString, ["capabilities"] = new JsonArray(announced) };
        var response = await SendAsync(HttpMethod.Post, identity.GatewayUrl, "/api/device/heartbeat", body, identity, cancellationToken);
        var root = await ReadJsonAsync(response, cancellationToken);
        return root["nextPollAfterMs"]?.GetValue<int>() ?? 20_000;
    }

    public async Task<(AgentCommand? Command, int NextPollAfterMs)> PollAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        var response = await SendAsync(HttpMethod.Post, identity.GatewayUrl, "/api/device/commands/poll", new JsonObject { ["leaseSeconds"] = 30 }, identity, cancellationToken);
        var root = await ReadJsonAsync(response, cancellationToken);
        var next = root["nextPollAfterMs"]?.GetValue<int>() ?? 20_000;
        if (root["command"] is not JsonObject command) return (null, next);
        var parsed = new AgentCommand(
            Required(command, "id"), Required(command, "actionId"), Required(command, "taskId"), Required(command, "attemptId"), Required(command, "capability"), Required(command, "operation"), Required(command, "target"),
            command["parameters"]?.AsObject() ?? new JsonObject(), Required(command, "actionFingerprint"), Required(command, "idempotencyKey"), Required(command, "commandNonce"),
            DateTimeOffset.Parse(Required(command, "expiresAt")), Required(command, "leaseToken"), DateTimeOffset.Parse(Required(command, "leaseExpiresAt")), Required(command, "correlationId"), command["protocolVersion"]?.GetValue<int>() ?? 0);
        if (parsed.ProtocolVersion != 1 || parsed.ExpiresAt <= DateTimeOffset.UtcNow || parsed.LeaseExpiresAt <= DateTimeOffset.UtcNow) throw new GatewayRejectedException("COMMAND_INVALID");
        return (parsed, next);
    }

    public async Task SendUnsupportedResultAsync(AgentIdentity identity, AgentCommand command, CancellationToken cancellationToken)
    {
        var receipt = new JsonObject { ["commandId"] = command.Id, ["attemptId"] = command.AttemptId, ["leaseToken"] = command.LeaseToken, ["commandNonce"] = command.CommandNonce, ["state"] = "accepted" };
        await EnsureSuccess(await SendAsync(HttpMethod.Post, identity.GatewayUrl, "/api/device/commands/receipt", receipt, identity, cancellationToken), cancellationToken);
        var result = new JsonObject
        {
            ["commandId"] = command.Id, ["attemptId"] = command.AttemptId, ["leaseToken"] = command.LeaseToken, ["commandNonce"] = command.CommandNonce,
            ["status"] = "failed", ["output"] = new JsonObject { ["kind"] = "unsupported", ["operation"] = command.Operation },
            ["errorCode"] = "unsupported_operation", ["agentVersion"] = AgentVersion, ["correlationId"] = command.CorrelationId,
        };
        await EnsureSuccess(await SendAsync(HttpMethod.Post, identity.GatewayUrl, "/api/device/commands/result", result, identity, cancellationToken), cancellationToken);
    }

    public async Task RevokeAsync(AgentIdentity identity, CancellationToken cancellationToken)
    {
        var body = new JsonObject { ["reason"] = "user_mode_agent_disconnect" };
        await EnsureSuccess(await SendAsync(HttpMethod.Post, identity.GatewayUrl, "/api/device/self-revoke", body, identity, cancellationToken), cancellationToken);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string gatewayUrl, string path, JsonObject body, AgentIdentity? identity, CancellationToken token)
    {
        var canonical = CanonicalJson.Serialize(body);
        using var request = new HttpRequestMessage(method, new Uri(new Uri(NormalizeGateway(gatewayUrl)), path));
        request.Content = new StringContent(canonical, Encoding.UTF8, "application/json");
        if (identity is not null)
        {
            var timestamp = DateTimeOffset.UtcNow.ToString("O");
            var nonce = CanonicalJson.RandomToken();
            var digest = CanonicalJson.Sha256Base64Url(canonical);
            var message = string.Join('\n', method.Method.ToUpperInvariant(), path, timestamp, nonce, digest);
            request.Headers.Add("x-pegasus-device-id", identity.DeviceId);
            request.Headers.Add("x-pegasus-key-id", identity.KeyId);
            request.Headers.Add("x-pegasus-timestamp", timestamp);
            request.Headers.Add("x-pegasus-nonce", nonce);
            request.Headers.Add("x-pegasus-body-digest", digest);
            request.Headers.Add("x-pegasus-signature", AgentSigner.Sign(identity.PrivateKeyBase64, message));
        }
        return await http.SendAsync(request, token);
    }

    private static async Task<JsonObject> ReadJsonAsync(HttpResponseMessage response, CancellationToken token)
    {
        await EnsureSuccess(response, token);
        return (await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: token)) ?? throw new GatewayRejectedException("GATEWAY_RESPONSE_INVALID");
    }

    private static async Task EnsureSuccess(HttpResponseMessage response, CancellationToken token)
    {
        if (response.IsSuccessStatusCode) return;
        var body = await response.Content.ReadAsStringAsync(token);
        if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized) throw new GatewayRejectedException("AGENT_REVOKED");
        throw new GatewayRejectedException("GATEWAY_" + ((int)response.StatusCode).ToString(), body);
    }

    private static string Required(JsonObject value, string key) => value[key]?.GetValue<string>() ?? throw new GatewayRejectedException("COMMAND_INVALID");
    private static string NormalizeGateway(string gatewayUrl) => gatewayUrl.TrimEnd('/') + "/";
}

public sealed class GatewayRejectedException : Exception
{
    public GatewayRejectedException(string code, string? detail = null) : base(code) => Code = code;
    public string Code { get; }
}
