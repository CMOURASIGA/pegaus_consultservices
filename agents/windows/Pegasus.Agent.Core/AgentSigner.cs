using System.Security.Cryptography;
using System.Text;

namespace Pegasus.Agent.Core;

public static class AgentSigner
{
    public static (string PrivateKeyBase64, string PublicKeyPem, string KeyId) CreateIdentity()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var publicDer = key.ExportSubjectPublicKeyInfo();
        var publicPem = "-----BEGIN PUBLIC KEY-----\n" + Convert.ToBase64String(publicDer, Base64FormattingOptions.InsertLineBreaks) + "\n-----END PUBLIC KEY-----";
        return (Convert.ToBase64String(key.ExportPkcs8PrivateKey()), publicPem, "agent-" + Guid.NewGuid().ToString("N"));
    }

    public static string Sign(string privateKeyBase64, string message)
    {
        using var key = ECDsa.Create();
        key.ImportPkcs8PrivateKey(Convert.FromBase64String(privateKeyBase64), out _);
        var signature = key.SignData(Encoding.UTF8.GetBytes(message), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return Convert.ToBase64String(signature).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
