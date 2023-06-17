# Krunker Decompiler

[See an example](https://gist.github.com/e9x/eea9ecb2c0ce6fe0517ff522e78d282a)

Powered by:

- [webcrack](https://github.com/j4k0xb/webcrack) (current)
- [synchrony](https://github.com/relative/synchrony) (variable renaming)

## Quickstart

1. Get the repository & dependencies

```
git clone https://github.com/e9x/krunker-decompiler.git
cd krunker-decompiler
npm install
```

2. Build the decompiler

```
npm run build
```

2. Get the game source

   ```
   [user@linux krunker-decompiler]$ cat ../krunker.05.12.23.js
   (function(iÌïiîií,iÏïïîiî){var iIiííìi=a3iíiíîiî,iÎìîìíì=iÌïiîií();while(!![]){try{var iIiiîîí=-parseInt(iIiííìi(0xc99))/0x1*(-parseInt(iIiííìi(0x172c))/0x2)+parseInt(iIiííìi(0xc3e))/0x3*(parseInt(iIiííìi(0x1623))/0x4)+-parseInt(iIiííìi(0x40a))/0x5+parseInt(iIiííìi(0x19b1))/0x6+-parseInt(iIiííìi(0x4888))/0x7+-parseInt(iIiííìi(0x45f8))/0x8*(-parseInt(iIiííìi(0xc7d))/0x9)+-parseInt(iIiííìi(0x2d1a))/0xa*(parseInt(iIiííìi(0x2699))/0xb);if(iIiiîîí===iÏïïîiî)break;else iÎìîìíì['push'](iÎìîìíì['shift']());}catch(iÏiîiií){iÎìîìíì['push'](iÎìîìíì['shift']());}}}(a3iìiìïìi,0x7bbf4),function(iïíîïii){var iiïîììí=(function(){var iiíiìií=!![];return function(iîìiíiì,iîiìiìî){var iiïîiìí=iiíiìií?function(){if(iîiìiìî){var iíïîïïí=
   ```

   Make sure your source:

   - Is not wrapped in an anonymous function
     You can modify the source to remove the wrapper.

   ```js
   (function anonymous(b475796ed633d5fd0485
   ) {

   (/* source goes here */)
   })
   ```

- Starts with a newline
  This is to match the real bundle. The bundle itself starts with a newline. However, this is optional.

3. Deobfuscate the source

   ```sh
   npm run deobfuscate ../krunker.js
   ```

4. Unpack the webpack modules

   This will split each module into an individual file.

   ```sh
   npm run unpack
   ```

5. Process the modules

   This will undo all minifications to the source and rename the variables.

   ```sh
   npm run process
   ```

6. Rename the modules.

   This will rename JSON modules to .json files. In the future, this will assign the modules to their correct names.

   ```
   npm run rename
   ```

You can find the result in the `rename` directory.

## Get the game source (Chromium)

1. Go to Krunker
2. Open devtools
3. Refresh the tab
4. Click on "Network"
5. Find "seek-game?hostname=krunker.io..."
6. Click on "Initiator"
7. Click on the link to "VM XXX:X"
   A VM is a JavaScript virtual machine. It's assigned a number for debugging.
8. Wait for the VM's source to load. This may take up to 5 minutes depending on your machine.
9. Right click the tab in the source viewer. It should be named "VM XXX"
10. Select "Save as..."
11. Enter a name that ends with .js, like `krunker.js`
12. Close Devtools and Krunker

### Fixing the source for use in the decompiler

Because the source is wrapped in a way that the decompiler doesn't understand, you'll have to modify it.

1. Open the source in an editor capable of handling an 8 MB file
   Like VS Code.

2. Remove the first 2 lines:

   ```js
   (function anonymous(b475796ed633d5fd0485
   ) {
   ```

3. Remove the last line:

   ```js
   })
   ```

4. Save

## How to find the Webpack entry point (aka `theatre.js`)

1.  Deobfuscate the source (if you haven't already)

    ```sh
    npm run deobfuscate ../krunker.js
    ```

2.  Run the locate entry script

    ```sh
    npm run locateEntry
    ```

    This will output "Entry point module ID: NUMBER"
    NUMBER being a literal number.

    This is the ID of the entry point module. The modules can be obtained by running the decompiling steps above.

    So for this example, the entry point script would be named `NUMBER.js`.
