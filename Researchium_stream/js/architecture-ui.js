/**
 * Architecture section: deployment diagram, research stack, WebRTC path.
 */
(function () {
  const { RESEARCH_STACK, WEBRTC_PIPELINE } = Researchium.StackLayers;
  const { DEPLOYMENT_NODES, DEPLOYMENT_EDGES } = Researchium.InfraStack;
  const { PipelineCanvas } = Researchium.WebRTC;
  const { InfraDiagram } = Researchium.InfraDiagram;

  function setPreview(layer, pathLabel) {
    const preview = document.getElementById('archCodePreview');
    const label = document.getElementById('archCodeLabel');
    const path = document.getElementById('archCodePath');
    if (preview) preview.textContent = layer.snippet;
    if (label) label.textContent = layer.id;
    if (path) path.textContent = pathLabel;
  }

  function mountResearchStack(container) {
    let activeId = RESEARCH_STACK[2].id;

    function setActive(id) {
      activeId = id;
      const layer = RESEARCH_STACK.find((l) => l.id === id);
      container.querySelectorAll('.stack-layer').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.id === id);
      });
      setPreview(layer, 'researchium / layer scaffold');
    }

    RESEARCH_STACK.forEach((layer, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stack-layer fade-in';
      btn.dataset.id = layer.id;
      btn.style.setProperty('--layer-color', layer.color);
      btn.style.animationDelay = `${i * 0.06}s`;

      const idx = document.createElement('span');
      idx.className = 'stack-layer-idx mono';
      idx.textContent = String(RESEARCH_STACK.length - i).padStart(2, '0');

      const body = document.createElement('span');
      body.className = 'stack-layer-body';
      const lbl = document.createElement('span');
      lbl.className = 'stack-layer-label';
      lbl.textContent = layer.label;
      const short = document.createElement('span');
      short.className = 'stack-layer-short';
      short.textContent = layer.short;
      body.append(lbl, short);

      const bar = document.createElement('span');
      bar.className = 'stack-layer-bar';
      bar.setAttribute('aria-hidden', 'true');

      btn.append(idx, body, bar);
      btn.addEventListener('click', () => setActive(layer.id));
      container.appendChild(btn);
    });

    setActive(activeId);
  }

  function mountWebRTCList(container) {
    const list = document.createElement('ol');
    list.className = 'pipeline-steps mono';
    WEBRTC_PIPELINE.forEach((step, i) => {
      const li = document.createElement('li');
      const n = document.createElement('span');
      n.className = 'pipeline-step-n';
      n.textContent = String(i + 1);
      const role = document.createElement('span');
      role.className = 'pipeline-step-role';
      role.textContent = step.role;
      li.append(n, document.createTextNode(step.label), role);
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function init() {
    const stackRoot = document.getElementById('researchStack');
    const canvas = document.getElementById('webrtcPipeline');
    const pipelineList = document.getElementById('webrtcSteps');
    const infraCanvas = document.getElementById('infraDiagram');

    if (infraCanvas) {
      const defaultNode = DEPLOYMENT_NODES.find((n) => n.id === 'react') || DEPLOYMENT_NODES[0];
      setPreview(defaultNode, 'services/ + apps/web');
      const diagram = new InfraDiagram(
        infraCanvas,
        DEPLOYMENT_NODES,
        DEPLOYMENT_EDGES,
        (node) =>
          setPreview(
            node,
            `services/${node.id === 'react' ? '../apps/web' : node.id}`
          )
      );
      diagram.start();
    }

    if (stackRoot) mountResearchStack(stackRoot);
    if (pipelineList) mountWebRTCList(pipelineList);
    if (canvas) new PipelineCanvas(canvas).start();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('#architecture .fade-in').forEach((el) => io.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
