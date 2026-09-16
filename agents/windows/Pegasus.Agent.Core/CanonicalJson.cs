using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Pegasus.Agent.Core;

public static class CanonicalJson
{
    public static string Serialize(JsonNode? value) => value switch
    {
        null => "null",
        JsonObject obj => "{" + string.Join(",", obj.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => JsonSerializer.Serialize(pair.Key) + ":" + Serialize(pair.Value))) + "}",
        JsonArray array => "[" + string.Join(",", array.Select(Serialize)) + "]",
        JsonValue scalar => scalar.ToJsonString(new JsonSerializerOptions { WriteIndented = false }),
        _ => throw new InvalidOperationException("Unsupported JSON value."),
    };

    public static string Sha256Base64Url(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static string RandomToken(int bytes = 32)
    {
        var buffer = RandomNumberGenerator.GetBytes(bytes);
        return Convert.ToBase64String(buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
