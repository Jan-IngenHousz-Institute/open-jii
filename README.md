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
- Visualize and share research results

## Tech Stack

### Frontend

Next.js with Tailwind CSS and Radix UI components via ShadCN.

### Backend

NestJS API with Drizzle ORM for databases and Zod for validation.

### Infrastructure

AWS infrastructure managed with OpenTofu (formerly Terraform) and Databricks for data processing pipelines.

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
```

## Development Tools

The repository includes several development tools to help you work with the platform:

- **MultispeQ Interface**: Tools for interfacing with MultispeQ devices
- **Node-RED**: Available for custom IoT prototyping if needed (`pnpm --filter node-red start`)
- **API Documentation**: Auto-generated API docs via Swagger

## Documentation

Visit our [Documentation Hub](https://docs.openjii.org) or browse the `apps/docs` directory for:

- Getting started guides
- Data platform documentation
- Developer guides and API references
- Research methodology documentation

## Contributing

We welcome contributions! Please check our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the terms found in [LICENSE](LICENSE).

## Links

- [Project Website](https://www.openjii.org)
- [Documentation](https://docs.openjii.org)
- [Jan IngenHousz Institute](https://www.jan-ingenhousz-institute.org)
