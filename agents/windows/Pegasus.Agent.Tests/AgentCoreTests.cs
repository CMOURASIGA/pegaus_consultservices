using System.Text.Json.Nodes;
using Pegasus.Agent.Core;
using Xunit;

namespace Pegasus.Agent.Tests;

public sealed class AgentCoreTests
{
    [Fact]
    public void Pairing_code_requires_uuid_and_long_single_use_token()
    {
        Assert.False(PairingCode.TryParse("bad.token", out _));
        Assert.False(PairingCode.TryParse(Guid.NewGuid() + ".short", out _));
        Assert.True(PairingCode.TryParse(Guid.NewGuid() + "." + new string('a', 32), out var parsed));
        Assert.NotNull(parsed);
    }

    [Fact]
    public void Canonical_json_sorts_object_keys_like_gateway()
    {
        var value = new JsonObject { ["z"] = 2, ["a"] = new JsonObject { ["b"] = true, ["a"] = "x" } };
        Assert.Equal("{\"a\":{\"a\":\"x\",\"b\":true},\"z\":2}", CanonicalJson.Serialize(value));
    }

    [Fact]
    public void Signature_uses_p256_webcrypto_compatible_format()
    {
        var identity = AgentSigner.CreateIdentity();
        var signature = AgentSigner.Sign(identity.PrivateKeyBase64, "test");
        Assert.NotEmpty(identity.PublicKeyPem);
        Assert.Equal(86, signature.Length);
    }

    [Fact]
    public async Task Pairing_persists_then_restart_uses_existing_identity_without_pairing_again()
    {
        var store = new MemoryIdentityStore(); var gateway = new FakeGateway(); var agent = new UserModeAgent(store, gateway);
        var code = new PairingCode(Guid.NewGuid().ToString(), new string('x', 32));
        await agent.PairAsync(code, "https://pegasus.test", CancellationToken.None);
        var restarted = new UserModeAgent(store, gateway);
        Assert.NotNull(restarted.Identity);
        Assert.Equal(1, gateway.PairingCalls);
    }

    [Fact]
    public void Windows_identity_is_protected_for_the_current_user()
    {
        var path = Path.Combine(Path.GetTempPath(), "pegasus-agent-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new WindowsDpapiIdentityStore(path); var identity = FakeIdentity();
            store.Save(identity);
            var encrypted = File.ReadAllText(Path.Combine(path, "identity.v1.protected"));
            Assert.DoesNotContain(identity.PrivateKeyBase64, encrypted, StringComparison.Ordinal);
            Assert.Equal(identity.DeviceId, store.Load()?.DeviceId);
        }
        finally { if (Directory.Exists(path)) Directory.Delete(path, true); }
    }

    [Fact]
    public async Task Unsupported_command_returns_structured_permanent_result()
    {
        var gateway = new FakeGateway { Command = Command() }; var store = new MemoryIdentityStore(); var identity = FakeIdentity(); store.Save(identity);
        var agent = new UserModeAgent(store, gateway); using var stop = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        await agent.RunAsync(stop.Token);
        Assert.Equal("unsupported_operation", gateway.LastErrorCode);
    }

    [Fact]
    public async Task Disconnect_revokes_remotely_and_removes_local_identity()
    {
        var store = new MemoryIdentityStore(); store.Save(FakeIdentity()); var gateway = new FakeGateway(); var agent = new UserModeAgent(store, gateway);
        await agent.DisconnectAndRevokeAsync(CancellationToken.None);
        Assert.True(gateway.Revoked);
        Assert.Null(store.Load());
    }

    [Fact]
    public async Task Pause_stops_heartbeat_and_polling_until_resumed()
    {
        var store = new MemoryIdentityStore(); store.Save(FakeIdentity()); var gateway = new FakeGateway(); var agent = new UserModeAgent(store, gateway);
        agent.Pause(true); using var stop = new CancellationTokenSource(TimeSpan.FromMilliseconds(40));
        await agent.RunAsync(stop.Token);
        Assert.Equal(0, gateway.HeartbeatCalls);
    }

    private static AgentIdentity FakeIdentity() => new("device", "agent-key", "private", "public", "https://pegasus.test", new[] { "filesystem.list" }, DateTimeOffset.UtcNow);
    private static AgentCommand Command() => new("command", "action", "task", "attempt", "filesystem.list", "filesystem.list", "root", new JsonObject(), "fingerprint", "idempotency", new string('n', 32), DateTimeOffset.UtcNow.AddMinutes(1), new string('l', 32), DateTimeOffset.UtcNow.AddMinutes(1), Guid.NewGuid().ToString(), 1);

    private sealed class MemoryIdentityStore : IIdentityStore { private AgentIdentity? value; public AgentIdentity? Load() => value; public void Save(AgentIdentity identity) => value = identity; public void Delete() => value = null; }
    private sealed class FakeGateway : IAgentGatewayClient
    {
        public int PairingCalls { get; private set; } public int HeartbeatCalls { get; private set; } public AgentCommand? Command { get; set; } public string? LastErrorCode { get; private set; } public bool Revoked { get; private set; }
        public Task<AgentIdentity> CompletePairingAsync(PairingCode code, string url, CancellationToken token) { PairingCalls++; return Task.FromResult(FakeIdentity()); }
        public Task<int> HeartbeatAsync(AgentIdentity identity, CancellationToken token) { HeartbeatCalls++; return Task.FromResult(5_000); }
        public Task<(AgentCommand? Command, int NextPollAfterMs)> PollAsync(AgentIdentity identity, CancellationToken token) { var result = Command; Command = null; return Task.FromResult((result, 5_000)); }
        public Task SendUnsupportedResultAsync(AgentIdentity identity, AgentCommand command, CancellationToken token) { LastErrorCode = "unsupported_operation"; return Task.CompletedTask; }
        public Task RevokeAsync(AgentIdentity identity, CancellationToken token) { Revoked = true; return Task.CompletedTask; }
    }
}
