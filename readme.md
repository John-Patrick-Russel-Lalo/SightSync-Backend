# Modular Monolith Project

A robust Node.js application designed with a Modular Monolithic architecture. This project aims to balance the simplicity of a single deployment unit with the maintainability and separation of concerns typically found in microservices.

## Architecture

This project follows the **Modular Monolith** pattern:
- **Encapsulation**: Each module contains its own business logic, data access, and API contracts.
- **Inter-module Communication**: Modules communicate via internal interfaces or event buses rather than network calls.
- **Scalability**: Designed to be easily split into microservices if the need arises in the future.

## Features

- **Pattern Matching**: Advanced glob and brace expansion support for flexible configuration and file discovery.
- **Path Normalization**: Cross-platform path handling to ensure consistency across Windows and POSIX systems.
- **Coverage Reporting**: Integrated V8-based code coverage for high-quality testing.
- **Modular Design**: Domain-driven boundaries within a single codebase.

## Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Path Utilities**: `normalize-path`, `is-glob`, `is-number`
- **Pattern Matching**: `braces`, `fill-range`, `to-regex-range`
- **Testing & Coverage**: `@bcoe/v8-coverage`

## Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

## Installation

```bash
cd "SightSync-Backend"
npm install
```

## Running the Application

To start the main application entry point:

```bash
npm start
```

## Testing

Run the test suite with coverage reporting:

```bash
npm test
```

## License

This project is licensed under the MIT License.

