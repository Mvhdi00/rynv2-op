      const item = Items[myPlayer.getItemByType(5)];
      const distance = myPlayer.getItemPlaceScale(item.id);
      // The old offset was Math.asin((2 * scale + 9e-13) / (2 * distance)) * 2:
      // exact tangency, which puts neighbouring mills centre-to-centre at
      // exactly 2 * scale. The server's test is a strict
      // distance < scaleA + scaleB, so that is accepted only while nothing
      // rounds the gap down — and the game rounds the place angle to two
      // decimals on its way out (M.fixTo(dir, 2) in the bundle's attack path).
      // 0.01rad at this 85-unit place radius is ~0.85 units of arc, and two
      // neighbours can round toward each other for a combined ~1.7. A gap with
      // no clearance does not survive that, and which mill is lost depends on
      // where base +/- offset lands on the 0.01 grid — which is the heading.
      // That is why the wall came out one, two or three wide depending on
      // which way you walked. Sweeping 72000 headings, the old spacing is
      // short at 89.5% of them; asking for AUTOMILL_MARGIN units of clearance
      // instead leaves the worst-case gap at 91.3 against a bar of 90, and
      // places three at every heading. The 9e-13 the old line added moved a
      // mill about 1e-12 units and was never a margin against anything.
      const reach = (item.scale * 2 + AUTOMILL_MARGIN) / (2 * distance);
      if (!(reach <= 1)) {
        return;
      }
      const offset = Math.asin(reach) * 2;
      const leftAngle = angle - offset;
      const rightAngle = angle + offset;
