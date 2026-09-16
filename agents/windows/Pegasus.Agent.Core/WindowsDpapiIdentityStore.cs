using System.Security.Cryptography;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;

namespace Pegasus.Agent.Core;

public sealed class WindowsDpapiIdentityStore : IIdentityStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Pegasus.Agent.Identity.v1.CurrentUser");
    private readonly string path;

    public WindowsDpapiIdentityStore(string? basePath = null)
    {
        var root = basePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Pegasus", "Agent");
        path = Path.Combine(root, "identity.v1.protected");
    }

    public AgentIdentity? Load()
    {
        if (!File.Exists(path)) return null;
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("A identidade do Pegasus Agent usa DPAPI do usuário Windows.");
        try
        {
            var encrypted = File.ReadAllBytes(path);
            var plaintext = UnprotectForCurrentUser(encrypted);
            return JsonSerializer.Deserialize<AgentIdentity>(plaintext) ?? throw new CryptographicException("Identity data is invalid.");
        }
        catch (CryptographicException exception)
        {
            throw new InvalidOperationException("Não foi possível abrir a identidade protegida deste usuário Windows.", exception);
        }
    }

    public void Save(AgentIdentity identity)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("A identidade do Pegasus Agent usa DPAPI do usuário Windows.");
        var directory = Path.GetDirectoryName(path) ?? throw new InvalidOperationException("Identity path is invalid.");
        Directory.CreateDirectory(directory);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(identity);
        var encrypted = ProtectForCurrentUser(plaintext);
        var temporary = path + ".tmp";
        File.WriteAllBytes(temporary, encrypted);
        File.Move(temporary, path, true);
    }

    public void Delete()
    {
        if (File.Exists(path)) File.Delete(path);
    }

    [SupportedOSPlatform("windows")]
    private static byte[] ProtectForCurrentUser(byte[] plaintext) => ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);

    [SupportedOSPlatform("windows")]
    private static byte[] UnprotectForCurrentUser(byte[] encrypted) => ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
}
