namespace Pegasus.Agent.Core;

public sealed class UserModeAgent
{
    private readonly IIdentityStore store;
    private readonly IAgentGatewayClient gateway;
    private readonly TimeProvider time;
    private volatile bool paused;

    public event Action<AgentStatus>? StatusChanged;

    public UserModeAgent(IIdentityStore store, IAgentGatewayClient gateway, TimeProvider? timeProvider = null)
    {
        this.store = store;
        this.gateway = gateway;
        time = timeProvider ?? TimeProvider.System;
    }

    public AgentIdentity? Identity => store.Load();

    public async Task PairAsync(PairingCode code, string gatewayUrl, CancellationToken cancellationToken)
    {
        if (Identity is not null) throw new InvalidOperationException("Este Agent já está pareado. Desconecte antes de parear novamente.");
        Publish(false, "Pareando com Pegasus.");
        var identity = await gateway.CompletePairingAsync(code, gatewayUrl, cancellationToken);
        store.Save(identity);
        Publish(true, "Pareado. Aguardando a primeira comunicação.");
    }

    public void Pause(bool value)
    {
        paused = value;
        Publish(Identity is not null && !paused, paused ? "Acesso local pausado." : "Acesso local retomado.");
    }

    public async Task DisconnectAndRevokeAsync(CancellationToken cancellationToken)
    {
        var identity = Identity;
        if (identity is not null)
        {
            try { await gateway.RevokeAsync(identity, cancellationToken); }
            finally { store.Delete(); }
        }
        paused = true;
        Publish(false, "Dispositivo desconectado e revogado.");
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var delay = TimeSpan.FromSeconds(2);
        while (!cancellationToken.IsCancellationRequested)
        {
            var identity = Identity;
            if (identity is null || paused)
            {
                Publish(false, identity is null ? "Aguardando pareamento." : "Acesso local pausado.");
                await Delay(TimeSpan.FromSeconds(2), cancellationToken);
                continue;
            }
            try
            {
                await gateway.HeartbeatAsync(identity, cancellationToken);
                var poll = await gateway.PollAsync(identity, cancellationToken);
                if (poll.Command is not null) await gateway.SendUnsupportedResultAsync(identity, poll.Command, cancellationToken);
                delay = TimeSpan.FromMilliseconds(Math.Clamp(poll.NextPollAfterMs, 5_000, 60_000));
                Publish(true, "Conectado. Última comunicação agora.");
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
            catch (GatewayRejectedException exception) when (exception.Code == "AGENT_REVOKED")
            {
                store.Delete();
                paused = true;
                Publish(false, "Acesso revogado no Pegasus. É necessário realizar novo pareamento.");
                break;
            }
            catch (Exception exception)
            {
                delay = TimeSpan.FromMilliseconds(Math.Min(delay.TotalMilliseconds * 2, TimeSpan.FromMinutes(5).TotalMilliseconds));
                Publish(false, "Sem conexão. Nova tentativa programada.");
                _ = exception;
            }
            await Delay(delay, cancellationToken);
        }
    }

    private Task Delay(TimeSpan duration, CancellationToken token) => Task.Delay(duration, time, token);

    private void Publish(bool connected, string detail)
    {
        var identity = Identity;
        StatusChanged?.Invoke(new AgentStatus(connected, paused, identity?.DeviceId, connected ? DateTimeOffset.UtcNow.ToString("O") : null, identity?.GrantedCapabilities ?? Array.Empty<string>(), detail));
    }
}
