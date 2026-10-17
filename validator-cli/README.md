# Validator CLI

Run website checks for the dPIN network.

## Start

Use Node.js 22.12+. Register a validator through the website and save its signing key.

```sh
npm ci
npm start -- start /path/to/validator-private-key.txt
```

Set `hubServer` in `config/config.json` to your hub address.

## Commands

```sh
npm start -- --help
npm start -- info /path/to/validator-private-key.txt
npm start -- ping https://example.com
npm test
```

License: ISC.
