using System.Text.Json.Nodes;

namespace Pegasus.Agent.Core;

public sealed record AgentIdentity(string DeviceId, string KeyId, string PrivateKeyBase64, string PublicKeyPem, string GatewayUrl, IReadOnlyList<string> GrantedCapabilities, DateTimeOffset PairedAt);

public sealed record PairingCode(string ChallengeId, string Token)
{
    public static bool TryParse(string? value, out PairingCode? code)
    {
        code = null;
        var parts = value?.Trim().Split('.', 2, StringSplitOptions.TrimEntries);
        if (parts is not [var challenge, var token] || !Guid.TryParse(challenge, out _) || token.Length < 32) return false;
        code = new PairingCode(challenge, token);
        return true;
    }
}

public sealed record AgentCommand(
    string Id, string ActionId, string TaskId, string AttemptId, string Capability, string Operation,
    string Target, JsonObject Parameters, string ActionFingerprint, string IdempotencyKey,
    string CommandNonce, DateTimeOffset ExpiresAt, string LeaseToken, DateTimeOffset LeaseExpiresAt,
    string CorrelationId, int ProtocolVersion);

public sealed record AgentStatus(bool Connected, bool Paused, string? DeviceId, string? LastCommunication, IReadOnlyList<string> Capabilities, string Detail);

public interface IIdentityStore
{
    AgentIdentity? Load();
    void Save(AgentIdentity identity);
    void Delete();
}

public interface IAgentGatewayClient
{
    Task<AgentIdentity> CompletePairingAsync(PairingCode pairingCode, string gatewayUrl, CancellationToken cancellationToken);
    Task<int> HeartbeatAsync(AgentIdentity identity, CancellationToken cancellationToken);
    Task<(AgentCommand? Command, int NextPollAfterMs)> PollAsync(AgentIdentity identity, CancellationToken cancellationToken);
    Task SendUnsupportedResultAsync(AgentIdentity identity, AgentCommand command, CancellationToken cancellationToken);
    Task RevokeAsync(AgentIdentity identity, CancellationToken cancellationToken);
}
