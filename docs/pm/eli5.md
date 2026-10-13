# ELI5

When a salesperson wins a customer, they hand the customer to the onboarding team. Lots of small facts have to travel with that handoff: which hiring system the customer uses, how many seats they bought, when they want to go live, whether they need single sign-on, and so on.

Those facts are scattered across an order form, call notes and emails. Sometimes they disagree. Sometimes they are missing. Sometimes they are old.

This lab does three things:

1. It helps decide which job like this is worth fixing first, using a simple sum you can see and argue with.
2. For the handoff, it pulls each fact out with the exact sentence it came from. If it can't find a fact, it says "unknown". If two notes disagree, it stops and asks a person to choose.
3. It writes down the rules as a playbook, so the next person can run the same process.

Everything inside it is made up for the demo. It doesn't send emails or change any real system.
