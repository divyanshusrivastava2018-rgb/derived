(function () {
  document.querySelectorAll(".feature-flip").forEach(function (card) {
    function setExpanded(on) {
      card.classList.toggle("is-flipped", on);
      card.setAttribute("aria-expanded", on ? "true" : "false");
    }

    card.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      setExpanded(!card.classList.contains("is-flipped"));
    });

    card.addEventListener("keydown", function (e) {
      if (e.target.closest("a")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setExpanded(!card.classList.contains("is-flipped"));
      }
      if (e.key === "Escape") {
        setExpanded(false);
      }
    });
  });
})();
