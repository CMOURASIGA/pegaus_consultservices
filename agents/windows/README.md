# Pegasus Agent for Windows, User Mode

This project is the first Windows host for the Pegasus Device Gateway. It runs with `asInvoker`, stores its ECDSA P-256 private identity protected by Windows DPAPI for the current user, and does not install a service, request elevation, inspect files, capture the screen, run a shell, or monitor the machine.

The shared `Pegasus.Agent.Core` owns identity, signatures, HTTPS protocol, heartbeat, polling and command handling. `Pegasus.Agent.UserMode` is only a Windows Forms and tray host. A future Service Mode must reuse the Core.

Before a first pairing, Christian creates a five-minute pairing code in Pegasus Web under **Meu computador**. The Agent accepts `challengeId.token`, proves possession of its locally generated key, and starts signed heartbeat and polling after the server-side pairing is approved.

Commands are never executed locally in this checkpoint. A typed command is acknowledged and receives a structured permanent `unsupported_operation` result.
