using System.Security.Cryptography;
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
        try
        {
            var encrypted = File.ReadAllBytes(path);
            var plaintext = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<AgentIdentity>(plaintext) ?? throw new CryptographicException("Identity data is invalid.");
        }
        catch (CryptographicException exception)
        {
            throw new InvalidOperationException("Não foi possível abrir a identidade protegida deste usuário Windows.", exception);
        }
    }

    public void Save(AgentIdentity identity)
    {
        var directory = Path.GetDirectoryName(path) ?? throw new InvalidOperationException("Identity path is invalid.");
        Directory.CreateDirectory(directory);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(identity);
        var encrypted = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);
        var temporary = path + ".tmp";
        File.WriteAllBytes(temporary, encrypted);
        File.Move(temporary, path, true);
    }

    public void Delete()
    {
        if (File.Exists(path)) File.Delete(path);
    }
}
