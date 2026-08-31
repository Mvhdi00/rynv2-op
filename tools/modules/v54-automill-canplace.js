    // A place sent this tick lands after the move, so legality is judged from
    // where the player will be. canPlaceObject reads pos.current;
    // AutoGrind.placeTurret in this same client already reads pos.future.
    canPlaceWindmill(angle) {
      const {myPlayer: myPlayer, ObjectManager: ObjectManager2} = this.client;
      const id = myPlayer.getItemByType(5);
      if (id === null) {
        return false;
      }
      const position = myPlayer.getPlacePosition(myPlayer.pos.future, id, angle);
      return ObjectManager2.canPlaceItem(id, position);
    }
