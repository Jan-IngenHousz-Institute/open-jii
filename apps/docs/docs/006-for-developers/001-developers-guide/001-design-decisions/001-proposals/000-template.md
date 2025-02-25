# 0. Proposal Template

## Overview

### Purpose

_To propose a new, standardized MQTT topic structure that will support the ingestion of experimental data from multiple device families. This proposal outlines a consistent naming convention to streamline integration and provide a scalable foundation for data ingestion._

### Scope

_This document focuses solely on defining the structure for the MQTT topic name used for data ingestion, detailing each topic component for clarity and consistency._

### Background

_Having well-defined MQTT topic structures for data ingestion will allow us to avoid challenges in message routing, scalability, and difficulties in managing devices, experiments, and protocols. By introducing a clear and scalable topic format, we aim to provide a foundation for efficient data routing, simplify filtering, and support future integrations and needs._

## Proposal

_We propose a structured topic format designed specifically for experiment data ingestion. This format is based on the device family and includes identifiers for both the protocol and the device, along with versioning details. The structure is intended to ensure that each message can be efficiently routed, filtered, and processed._

## Implementation

### Steps

1. **Documentation:**  
   _Update internal guidelines and AsyncAPI documentation to include the new topic format._

2. **Development:**  
   _Modify infrastructure to adopt the proposed topic structure. This includes updating Terraform code and related configuration files._

3. **Testing:**  
   _Conduct comprehensive testing using appropriate subscriptions to ensure that messages are correctly published and received._

4. **Monitoring & Feedback:**  
   _Monitor system performance after deployment and gather feedback from all stakeholders to refine the topic structure if necessary._

#### Timeline

_The change is expected to be implemented and delivered effective immediately or as per project schedule._

#### Dependencies

_Coordination with firmware developers and relevant research teams is required to verify the proposed data ingestion sequence._

## Proposal Feedback

_We welcome your input on this proposal. Please share your comments, suggestions, and any concerns so that we can refine and improve this approach. Your feedback is critical to ensuring that this solution meets our integration and operational needs._
