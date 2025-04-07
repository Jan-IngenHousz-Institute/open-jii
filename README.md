# OpenJII Platform

<p align="center">
  <img src="./apps/docs/static/img/logo.png" alt="OpenJII Logo" width="200"/>
</p>

An open-source platform for agricultural IoT research and plant phenotyping developed by the Jan IngenHousz Institute. OpenJII helps researchers collect, process, and analyze sensor data from MultispeQ devices and custom IoT sensors.

## What is OpenJII?

OpenJII is designed to support plant researchers throughout their workflow:

- Collect data from MultispeQ devices and custom IoT sensors
- Process and analyze data with our pipeline architecture
- Manage research experiments and datasets
- Create custom IoT devices using Node-RED flows

## Tech Stack

### Frontend
Next.js with Tailwind CSS and Radix UI components via ShadCN.

### Backend
NestJS API with Drizzle ORM for databases and Zod for validation.

### IoT & Infrastructure  
Node-RED for custom IoT device programming, and AWS infrastructure managed with OpenTofu (formerly Terraform). Databricks handles our data processing pipeline.

## Getting Started

### Prerequisites
- Node.js v22+
- pnpm
- Docker (for local development)

### Installation

```bash
# Clone and set up
git clone https://github.com/Jan-IngenHousz-Institute/open-jii.git
cd open-jii
nvm use
corepack enable
pnpm install
```

### Development Commands

```bash
# Day-to-day development
pnpm dev          # Run development servers
pnpm lint         # Check code style
pnpm test         # Run tests
pnpm build        # Build all apps

# IoT development with Node-RED
pnpm --filter node-red start  # Start at http://localhost:1880
```

## Using Node-RED for IoT Development

Our platform includes Node-RED to help you build custom IoT devices:

1. Start Node-RED with `pnpm --filter node-red start` 
2. Open http://localhost:1880 in your browser
3. Use our custom nodes for MQTT connections, sensor data processing, and OpenJII integration

See our [IoT Development Guide](apps/docs/docs/004-iot-development) for detailed tutorials.

## Documentation

Visit our [Documentation Hub](https://docs.openjii.org) or browse the `apps/docs` directory for:

- Getting started guides
- Data platform documentation
- IoT device development tutorials
- Developer guides and API references

## Contributing

We welcome contributions! Please check our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the terms found in [LICENSE](LICENSE).

## Links

- [Project Website](https://www.openjii.org)
- [Documentation](https://docs.openjii.org)
- [Jan IngenHousz Institute](https://www.jan-ingenhousz-institute.org)
