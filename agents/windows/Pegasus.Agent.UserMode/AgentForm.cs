using Pegasus.Agent.Core;

namespace Pegasus.Agent.UserMode;

public sealed class AgentForm : Form
{
    private readonly UserModeAgent agent;
    private readonly CancellationTokenSource cancellation = new();
    private readonly Label state = new() { AutoSize = true, MaximumSize = new Size(430, 0) };
    private readonly Label device = new() { AutoSize = true, MaximumSize = new Size(430, 0) };
    private readonly Label capabilities = new() { AutoSize = true, MaximumSize = new Size(430, 0) };
    private readonly Button connect = new() { Text = "Conectar e parear", AutoSize = true };
    private readonly Button pause = new() { Text = "Pausar acesso", AutoSize = true };
    private readonly Button disconnect = new() { Text = "Desconectar e revogar", AutoSize = true };
    private readonly NotifyIcon tray = new() { Text = "Pegasus Agent", Visible = true, Icon = SystemIcons.Information };

    public AgentForm()
    {
        Text = "Pegasus Agent";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        ClientSize = new Size(510, 250);
        var client = new HttpsGatewayClient();
        agent = new UserModeAgent(new WindowsDpapiIdentityStore(), client);
        agent.StatusChanged += Render;

        var title = new Label { Text = "Pegasus Agent", Font = new Font(Font.FontFamily, 16, FontStyle.Bold), AutoSize = true };
        var warning = new Label { Text = "Modo do usuário. Sem instalação administrativa e sem monitoramento local.", AutoSize = true, MaximumSize = new Size(440, 0) };
        var actions = new FlowLayoutPanel { AutoSize = true, WrapContents = true, FlowDirection = FlowDirection.LeftToRight };
        actions.Controls.AddRange([connect, pause, disconnect]);
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };
        layout.Controls.AddRange([title, warning, new Label { Text = "Status", AutoSize = true, Font = new Font(Font, FontStyle.Bold) }, state, device, capabilities, actions]);
        Controls.Add(layout);

        connect.Click += async (_, _) => await PairAsync();
        pause.Click += (_, _) => agent.Pause(!pause.Text.StartsWith("Retomar", StringComparison.Ordinal));
        disconnect.Click += async (_, _) => await DisconnectAsync();
        tray.DoubleClick += (_, _) => { Show(); WindowState = FormWindowState.Normal; Activate(); };
        tray.ContextMenuStrip = new ContextMenuStrip();
        tray.ContextMenuStrip.Items.Add("Abrir", null, (_, _) => { Show(); WindowState = FormWindowState.Normal; });
        tray.ContextMenuStrip.Items.Add("Sair", null, (_, _) => Close());
        FormClosing += (_, _) => { cancellation.Cancel(); tray.Visible = false; };
        _ = Task.Run(() => agent.RunAsync(cancellation.Token));
        Render(new AgentStatus(false, false, agent.Identity?.DeviceId, null, agent.Identity?.GrantedCapabilities ?? Array.Empty<string>(), agent.Identity is null ? "Aguardando pareamento." : "Iniciando conexão."));
    }

    private async Task PairAsync()
    {
        using var dialog = new PairingDialog();
        if (dialog.ShowDialog(this) != DialogResult.OK || !PairingCode.TryParse(dialog.PairingCode, out var code) || code is null) { MessageBox.Show("Use o código challengeId.token criado na página Meu computador.", "Pegasus Agent", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
        try { await agent.PairAsync(code, dialog.GatewayUrl, cancellation.Token); }
        catch (Exception exception) { MessageBox.Show("Não foi possível concluir o pareamento. " + exception.Message, "Pegasus Agent", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    private async Task DisconnectAsync()
    {
        if (MessageBox.Show("Revogar este computador no Pegasus e remover a identidade local?", "Pegasus Agent", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        try { await agent.DisconnectAndRevokeAsync(cancellation.Token); }
        catch (Exception exception) { MessageBox.Show("A identidade local foi removida, mas a revogação remota precisa ser confirmada no Pegasus. " + exception.Message, "Pegasus Agent", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }

    private void Render(AgentStatus status)
    {
        if (InvokeRequired) { BeginInvoke(() => Render(status)); return; }
        state.Text = "Estado: " + status.Detail;
        device.Text = "Dispositivo: " + (status.DeviceId ?? "não pareado");
        capabilities.Text = "Capabilities: " + (status.Capabilities.Count == 0 ? "nenhuma" : string.Join(", ", status.Capabilities));
        pause.Text = status.Paused ? "Retomar acesso" : "Pausar acesso";
        connect.Enabled = status.DeviceId is null;
        disconnect.Enabled = status.DeviceId is not null;
        tray.Text = status.Connected ? "Pegasus Agent, conectado" : "Pegasus Agent, " + status.Detail;
    }
}

public sealed class PairingDialog : Form
{
    private readonly TextBox code = new() { Width = 420 };
    private readonly TextBox gateway = new() { Width = 420, Text = "https://pegasus.consultservices.com.br" };
    public string PairingCode => code.Text;
    public string GatewayUrl => gateway.Text;

    public PairingDialog()
    {
        Text = "Parear Pegasus Agent"; StartPosition = FormStartPosition.CenterParent; ClientSize = new Size(480, 180); FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false;
        var submit = new Button { Text = "Parear", DialogResult = DialogResult.OK, AutoSize = true };
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(22), FlowDirection = FlowDirection.TopDown, WrapContents = false };
        layout.Controls.AddRange([new Label { Text = "URL do Pegasus", AutoSize = true }, gateway, new Label { Text = "Código de pareamento", AutoSize = true }, code, submit]);
        Controls.Add(layout); AcceptButton = submit;
    }
}
