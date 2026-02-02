# Roles and rights

The openJII platform has no platform-wide roles, so when navigating the web platform and the app, in principle everyone is the same, but there is a difference when it comes to individual experiments:  
Within an experiment a user that is part of that experiment can have a role: "experiment admin" or "experiment member". These roles are set **per experiment**.  To be concise we refer to them as 'admin' and 'member' roles. 

### Experiment admin
An experiment is set up and owned by an 'admin'. This person has editing (admin) rights to the entire experiment. An experiment can also be shared among multiple admins and once there are multiple admins, you can even be demoted to user or leave the experiment.

### Experiment member
An experiment member is appointed by an admin of an experiment. A member is someone who contributes to (manual) measurements and can support in setting up and configuring sensors and devices. Generally, a member is someone who takes measurements in a field (using the openJII mobile app).

### Roles and rights at experiments
|   | Non-member | Experiment member | Experiment admin | 
| :--- | :-----------: |:-----------: |:-----------: |
| See experiment | ✓ * | ✓ | ✓ |
| See experiment measurements/data/visualizations | ✓ * | ✓ | ✓ | 
| Add measurements via app | - | ✓ | ✓ | 
| Add/edit comments/flags (app&web) | - | ✓ | ✓ | 
| Leave an experiment | - | ✓ | ✓ ** | 
| Create/edit/delete visualisations | - | - | ✓ |
| (Bulk) Upload data via web | - | - | ✓ | 
| Edit experiment settings*** | - | - | ✓ |
| Edit measurement flow | - | - | ✓ |
| Add/remove members/admins from experiment | - | - | ✓ |
| Change role of members/admins | - | - | ✓ |
| Archive experiment | - | - | ✓ |

`*` unless experiment is private and embargo is active - those experiments are hidden  
`**`  unless you are the last admin  
`***` title, description, visibility, location  

### Protocols and macros
Protocols and macros can be seen and used by everyone. Editing is restricted to the user who created the protocol/macro.