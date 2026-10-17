# dpin.

Website monitoring with distributed validators.

- Uptime and response times
- Incident history and email alerts
- Private monitor dashboards
- Signed validator checks and reward tracking

## Run

Use Node.js 22.12+ and MongoDB. Copy each service's `.env.example` to `.env` and fill in its values.

```sh
# API
cd backend
npm ci
npm start
```

In separate terminals:

```sh
# Validator hub — from the project root
cd backend
npm run hub
```

```sh
# Website — from the project root
cd frontend
npm ci
npm run dev
```

## Validator

Register through the website and save your signing key.

```sh
cd validator-cli
npm ci
npm start -- start /path/to/validator-private-key.txt
```

Set the hub address in `validator-cli/config/config.json`.

## Check

```sh
cd backend
npm test
cd ../validator-cli
npm test
cd ../frontend
npm run lint
npm run build
```
