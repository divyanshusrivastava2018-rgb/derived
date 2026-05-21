# Mathematical text standard (backend)

All MCQ `text`, `question`, and `options` fields use **MathJax-style LaTeX**:

- Inline: `\( u_{t} = u_{xx} \)`
- Display / matrices: `\[ \begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix} \]`

## Example (heat equation)

```
Heat equation: \( u_{t} = u_{xx} \), with boundary conditions \( u(0, t) = u(\pi, t) = 0 \) and initial condition \( u(x, 0) = \sin(4x)\cos(3x) \). The value of \( u\left(\frac{\pi}{4}, t\right) \) equals:
```

## Files

- `gate-mcq-bank.json` — GATE mock questions
- `server/lib/mockTestCatalog.js` — category practice pools
- `server/lib/mathLatex.js` — normalizes and fixes legacy plain text on API responses

Frontend KaTeX renders `\( \)`, `\[ \]`, `$`, and `$$` automatically.
