using Pegasus.Agent.Core;

namespace Pegasus.Agent.UserMode;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        using var instance = new SingleInstanceGuard();
        if (!instance.IsPrimaryInstance)
        {
            MessageBox.Show("O Pegasus Agent já está em execução para este usuário Windows.", "Pegasus Agent", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        ApplicationConfiguration.Initialize();
        Application.Run(new AgentForm());
    }
}
