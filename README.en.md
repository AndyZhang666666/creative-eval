# Creative Eval · First iteration

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Current review tool](https://andyzhang666666.github.io/llm-output-eval/)

How do you check the judge before using it to score content?

## Product decisions

- Define observable rubric anchors before comparing prompts.
- Inspect repeatability, human disagreement and position bias separately.
- Keep original runs and failures; interface changes are not model improvements.

## Walkthrough

1. Read the rubric and design decisions for the first calibration iteration.
2. Inspect saved model output, author labels and failures by sample.
3. Open Eval Lab for the current review interface and the V1 / V2 iteration account.

## Run mode and limits

The first Eval iteration, retaining 40 constructed samples and 32 author labels. The current interface is llm-output-eval. Samples and criteria differ, so their scores must not be pooled.

Saved model outputs and calibration results belong to their original samples and prompts. This documentation update does not rerun model evaluations or establish production accuracy. Labels and disagreements remain inspectable.

## Run locally

```sh
npm ci
npm run dev
```

The original model workflow requires your own authorised endpoint and credentials as described in `.env.example`. Evaluation, stability and agreement scripts may incur model costs. The current no-key review experience is [Eval Lab](https://andyzhang666666.github.io/llm-output-eval/).

## Documentation

- [Product scope](docs/PRD.md)
- [Design decisions](docs/DECISIONS.md)
- [Implementation details and original records, Chinese](README.md)

Use the repository’s existing licence and notices. This update does not change usage rights.
