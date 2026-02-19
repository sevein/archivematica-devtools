(() => {
  const TARGET_HOST = "127.0.0.1";
  const TARGET_PORT = "62080";
  const LOG_PREFIX = "[Local Dev Shortcut Injector]";
  const PATH_TO_SELECT = [
    "archivematica",
    "archivematica-sampledata",
    "SampleTransfers",
    "Images",
    "pictures"
  ];
  const EXPECTED_PATH =
    "/home/archivematica/archivematica-sampledata/SampleTransfers/Images/pictures";
  const SHORTCUT_KEY = "s";
  const SHORTCUT_DESCRIPTION = "Ctrl+Shift+S";
  let isRunning = false;

  if (window.location.hostname !== TARGET_HOST || window.location.port !== TARGET_PORT) {
    return;
  }

  const fail = (step, reason) => {
    console.error(`${LOG_PREFIX} Step ${step} failed: ${reason}`);
    return false;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFor = async (step, reason, predicate, timeoutMs = 6000, intervalMs = 100) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = predicate();
        if (result) {
          return result;
        }
      } catch (error) {
        return fail(step, `${reason}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(intervalMs);
    }
    return fail(step, reason);
  };

  const waitForTreeNotBusy = async (step, treeContainer, timeoutMs = 15000) =>
    waitFor(
      step,
      'expected "div.transfer-tree-container" to finish loading (aria-busy="false")',
      () => {
        const isBusy = treeContainer.getAttribute("aria-busy") === "true";
        return isBusy ? false : true;
      },
      timeoutMs
    );

  const isVisible = (el) => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  };

  const findLabelElement = (li, label) => {
    const target = label.trim().toLowerCase();
    const candidates = li.querySelectorAll("span,button,a,div");
    for (const candidate of candidates) {
      if (!isVisible(candidate)) {
        continue;
      }
      const text = candidate.textContent?.trim().toLowerCase();
      if (text === target) {
        return candidate;
      }
    }
    return null;
  };

  const findTreeItemByLabel = (scope, label) => {
    const root = scope instanceof HTMLElement ? scope : document;
    const items = Array.from(root.querySelectorAll("li"));
    const target = label.trim().toLowerCase();

    for (const li of items) {
      if (scope instanceof HTMLLIElement && li === scope) {
        continue;
      }
      if (!isVisible(li)) {
        continue;
      }
      const labelEl = findLabelElement(li, label);
      if (labelEl) {
        return li;
      }
      const liText = li.textContent?.toLowerCase() ?? "";
      if (liText.includes(target)) {
        return li;
      }
    }
    return null;
  };

  const getAriaElement = (li, attrName) => {
    if (li.hasAttribute(attrName)) {
      return li;
    }
    return li.querySelector(`[${attrName}]`);
  };

  const getTreeNodeContent = (li) => li.querySelector(".tree-node-content");

  const getTreeNodeToggle = (li) => li.querySelector(".tree-node-toggle");

  const findTreeItemByIdOrLabel = (scope, id, label) => {
    if (id) {
      const byId = document.getElementById(id);
      if (byId instanceof HTMLLIElement) {
        return byId;
      }
    }
    return findTreeItemByLabel(scope, label);
  };

  const clickElement = (el) => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    el.click();
    return true;
  };

  const expandTreeNode = async (step, scope, label) => {
    const li = findTreeItemByLabel(scope, label);
    if (!li) {
      return null;
    }
    const liId = li.id || null;
    const labelEl = findLabelElement(li, label);
    const expandedEl = getAriaElement(li, "aria-expanded");
    const nodeContentEl = getTreeNodeContent(li);
    const toggleEl = getTreeNodeToggle(li);

    if (expandedEl?.getAttribute("aria-expanded") === "true") {
      return li;
    }

    if (expandedEl) {
      const clickTargets = [toggleEl, nodeContentEl, labelEl, expandedEl, li];
      let expanded = false;
      for (const target of clickTargets) {
        if (!clickElement(target)) {
          continue;
        }
        const ok = await waitFor(
          step,
          `expected "${label}" to be expanded (aria-expanded="true")`,
          () => {
            const currentLi = findTreeItemByIdOrLabel(scope, liId, label);
            if (!(currentLi instanceof HTMLLIElement)) {
              return false;
            }
            const currentExpandedEl = getAriaElement(currentLi, "aria-expanded");
            return currentExpandedEl?.getAttribute("aria-expanded") === "true";
          },
          10000
        );
        if (ok) {
          expanded = true;
          break;
        }
      }
      if (!expanded) {
        return null;
      }
    } else {
      if (!clickElement(nodeContentEl || labelEl || li)) {
        return null;
      }
      await sleep(150);
    }

    return findTreeItemByIdOrLabel(scope, liId, label);
  };

  const performSpecificAction = async () => {
    if (isRunning) {
      console.log(`${LOG_PREFIX} Automation already running, ignoring shortcut`);
      return;
    }

    isRunning = true;
    try {
      const epoch = String(Math.floor(Date.now() / 1000));

      // Step 1 + 2: Set transfer name input to unix epoch.
      const transferInput = document.querySelector("#transfer-browser input#transfer-name");
      if (!(transferInput instanceof HTMLInputElement)) {
        fail(2, 'could not find "#transfer-browser input#transfer-name"');
        return;
      }
      transferInput.focus();
      transferInput.value = epoch;
      transferInput.dispatchEvent(new Event("input", { bubbles: true }));
      transferInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Step 3: Open browser button if needed.
      const browseButton = document.querySelector("#transfer-browser button.btn-browse");
      if (!(browseButton instanceof HTMLElement)) {
        fail(3, 'could not find "#transfer-browser button.btn-browse"');
        return;
      }
      if (browseButton.getAttribute("aria-expanded") !== "true") {
        browseButton.click();
        const opened = await waitFor(
          3,
          'expected browse button to become aria-expanded="true"',
          () => browseButton.getAttribute("aria-expanded") === "true"
        );
        if (!opened) {
          return;
        }
      }

      // Step 4 + 5: Expand tree path until pictures.
      const treeContainer = await waitFor(
        4,
        'could not find "div.transfer-tree-container"',
        () => document.querySelector("div.transfer-tree-container")
      );
      if (!(treeContainer instanceof HTMLElement)) {
        return;
      }
      const treeReady = await waitForTreeNotBusy(4, treeContainer);
      if (!treeReady) {
        return;
      }

      let scope = treeContainer;
      for (const [index, segment] of PATH_TO_SELECT.slice(0, -1).entries()) {
        const stepNumber = 4;
        const expandedLi = await expandTreeNode(stepNumber, scope, segment);
        if (!expandedLi) {
          fail(
            stepNumber,
            `could not expand tree item "${segment}" while walking path at index ${index}`
          );
          return;
        }
        const treeSettled = await waitForTreeNotBusy(stepNumber, treeContainer);
        if (!treeSettled) {
          return;
        }
        const nextSegment = PATH_TO_SELECT[index + 1];
        if (nextSegment) {
          const nextNodeAvailable = await waitFor(
            stepNumber,
            `expected child tree item "${nextSegment}" to appear after expanding "${segment}"`,
            () => findTreeItemByLabel(expandedLi, nextSegment),
            12000
          );
          if (!nextNodeAvailable) {
            return;
          }
        }
        scope = expandedLi;
      }

      // Step 6: Select pictures and verify aria-selected=true.
      const picturesLabel = PATH_TO_SELECT[PATH_TO_SELECT.length - 1];
      const picturesLi = findTreeItemByLabel(scope, picturesLabel);
      if (!picturesLi) {
        fail(6, `could not find tree item "${picturesLabel}"`);
        return;
      }
      const picturesLabelEl = findLabelElement(picturesLi, picturesLabel);
      const picturesContentEl = getTreeNodeContent(picturesLi);
      if (!clickElement(picturesContentEl || picturesLabelEl || picturesLi)) {
        fail(6, `failed to click tree item "${picturesLabel}"`);
        return;
      }
      const picturesSelectedEl = getAriaElement(picturesLi, "aria-selected");
      if (picturesSelectedEl) {
        const selected = await waitFor(
          6,
          `expected "${picturesLabel}" to be selected (aria-selected="true")`,
          () => picturesSelectedEl.getAttribute("aria-selected") === "true"
        );
        if (!selected) {
          return;
        }
      }

      // Step 7: Click the "add" button from the file browser section.
      const actionButton = document.querySelector("section#file-browser button.transfer-tree-add-btn");
      if (!(actionButton instanceof HTMLElement)) {
        fail(7, 'could not find "section#file-browser button.transfer-tree-add-btn"');
        return;
      }
      actionButton.click();

      // Step 8: Verify resulting selected path.
      const pathConfirmed = await waitFor(
        8,
        `expected path "${EXPECTED_PATH}" in "#transfer-browser .path-container .path-item span.path"`,
        () => {
          const pathEls = document.querySelectorAll(
            "#transfer-browser .path-container .path-item span.path"
          );
          return Array.from(pathEls).some((el) => el.textContent?.trim() === EXPECTED_PATH);
        },
        8000
      );
      if (!pathConfirmed) {
        return;
      }

      // Step 9: Start with automated configuration.
      const configChoice = Array.from(
        document.querySelectorAll("#transfer-browser a.processing-config-choice")
      ).find((el) => {
        const aria = el.getAttribute("aria-label") || "";
        return aria.includes('Start with "automated" configuration') || aria.includes("automated");
      });
      if (!(configChoice instanceof HTMLElement)) {
        fail(
          9,
          'could not find `a.processing-config-choice` with aria-label containing "automated"'
        );
        return;
      }
      configChoice.click();

      // Step 10: Wait for success alert.
      const success = await waitFor(
        10,
        'expected "#transfer-browser .alert-success" to contain "started successfully"',
        () => {
          const successAlert = document.querySelector("#transfer-browser .alert-success");
          if (!(successAlert instanceof HTMLElement)) {
            return false;
          }
          return (successAlert.textContent || "").toLowerCase().includes("started successfully");
        },
        10000
      );
      if (!success) {
        return;
      }

      console.log(`${LOG_PREFIX} Automation completed successfully`);
    } finally {
      isRunning = false;
    }
  };

  window.addEventListener("keydown", (event) => {
    const isShortcut =
      event.ctrlKey && event.shiftKey && event.key.toLowerCase() === SHORTCUT_KEY;
    if (!isShortcut) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.log(`${LOG_PREFIX} Shortcut ${SHORTCUT_DESCRIPTION} detected, starting automation`);
    void performSpecificAction();
  }, true);
})();
