# Protocols / Macros


A protocol is an executable measurement recipe (steps, parameters, timings) the app/sensor follows to collect a Measurement and turns it into raq data.  
A [macro](#macros) is an piece of post-processing code that turns your raw data into more valuable processsed data that is easier to digeest.


## Contents of a protocol

- **Name & description:** concise human-readable title and short summary of the protocol's purpose.
- **Protocol code:** sensor-specific parameters such as integration time, LED intensity, or measurement mode.
- **Output schema:** the structure of the produced measurement record and any computed outputs.

## Creating a protocol

1. On the openJII web platform, go to the Protocols area.
2. Click **Create Protocol** and provide required metadata.
3. Configure measurement settings according to the sensor and experimental design.
4. Save and test the protocol with a small set of measurements.

Documentation on protocols for the Ambit will be published on this page as soon as possible.

Documentation on protocol structure for the MultispeQ can be found at:
https://help.photosynq.com/protocols/structure.html along with code snippets.

Be sure to add a macro that fits the protocol as well to post-process the measured data.

## Best practices

- Keep protocol names descriptive and versioned when you make breaking changes.
- Use short protocols for routine measurements and longer protocols when more metadata is required.

## Examples

- "Chlorophyll Fluorescence Standard": MultispeQ protocol using standard integration times and producing Fv/Fm and other derived traits.
- "Leaf Gas Exchange (Beta)": gas-exchange protocol with extended inputs and analysis macro for photosynthetic parameters.

For advanced usage and authoring of analysis macros, refer to the Developers guide and Analysis documentation.


## Macros

A macro is an piece of post-processing code that turns your raw data into more valuable processsed data that is easier to digeest.

## Creating a macro

1. On the openJII web platform, go to the Macros  area
2. Click **Create Macro** and provide required metadata.
3. Configure script (JavaScript/Python) for post-processing
5. Save and test the macro with a small set of measurements.

```jsx title="yourmacro.js"
/**
 * Macro for data  on openJII.org
 * by: John Doe
 * created: 5 December 2025
 */

// Define the output object 
var output = {};

/* Your code goes here */

if (json.time !== undefined){ // Check if the key time exists in json
    output.time = json.time; // Add key time and value to output
}

// Return data
return output;
```


Documentation on macros for the MultispeQ can be found on:
https://help.photosynq.com/macros/coding-and-functions.html#code-structure along with code snippets


## Best practices

- Keep macro names the same and the protocol to which it belongs
- Keep names descriptive and versioned when you make breaking changes.

