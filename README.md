# QuaXar: Cross-Platform GUI for Celestia Light Nodes

![Splash image](./docs/images/splash.png)

## ✨ Key Features

* One-click node creation
<p float="left">
  <img src="./docs/images/create-1.png" width="49%" />
  <img src="./docs/images/create-2.png" width="49%" />
</p>

* One-click node execution
<p float="left">
  <img src="./docs/images/execute-1.png" width="49%" />
  <img src="./docs/images/execute-2.png" width="49%" />
</p>

* Node deletion
<p float="left">
  <img src="./docs/images/delete-1.png" width="49%" />
</p>

* Network selection
<p float="left">
  <img src="./docs/images/network-selection-1.png" width="49%" />
  <img src="./docs/images/network-selection-2.png" width="49%" />
</p>

* RPC transaction from GUI
<p float="left">
  <img src="./docs/images/rpc-transaction-1.png" width="49%" />
</p>

* Copy text button and context-aware auto-completion
<p float="left">
  <img src="./docs/images/autocompletion.png" width="49%" />
</p>

* Celestia-themed cool design!

## Points to Look

### Run Celestia binary from React

* See [useCelestia](./src/hooks/useCelestia.ts). The hook returns `runCelestia` which can be called to send a signal to the main process of Electron.js app.
* When the main process got the signal, [window.celestia.run](./electron/handlers.cts#L142-L200) spawns a Celestia process with appropriate arguments.

### Download Celestia binary

* See [DownloadBinary](./src/pages/DownloadBinary.tsx). This component first calls `window.celestia.downloadBinary` to initiate the download process, and keep tracking of download progress.
* [`window.celestia.exists`](./main/electron/handlers.cts#L102-L104) checks if there is a Celestia binary file.
* [`window.celestia.downloadBinary`](./main/electron/handlers.cts#L105-L141) downloads the binary file and sending download progress to the client using `celestia:download-progress` channel.

### Query wallet data and DAS statistics

* [`installCelestiaQuery`](./src/pages/General.tsx#L19-L68) installs intervals polling respective queries by calling `runCelestia` and returns the cleanup function. The function is [called multiple times](./src/pages/General.tsx#L70-L78) to get data from various queries.

### RPC screen
* In [RPC page](./src/pages/RPC.tsx), parameter fields are generated declaratively using predefined [method list](./src/constants.ts#L43-L159) and [input components](./src/components).
