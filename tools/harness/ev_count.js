({ gl: window.__gl, res: performance.getEntriesByType("resource").filter(e => /assets\/index/.test(e.name)).map(e => e.name + " " + e.initiatorType), head: !!document.head })
