namespace Pegasus.Agent.Core;

public sealed class SingleInstanceGuard : IDisposable
{
    private readonly Mutex mutex;
    private readonly bool owns;

    public SingleInstanceGuard()
    {
        mutex = new Mutex(true, "Local\\Pegasus.Agent.UserMode", out owns);
    }

    public bool IsPrimaryInstance => owns;

    public void Dispose()
    {
        if (owns) mutex.ReleaseMutex();
        mutex.Dispose();
    }
}
