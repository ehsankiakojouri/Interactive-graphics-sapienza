# 🕹️ Light or Sting

**Light or Sting** is a real-time interactive game developed as part of the **Interactive Graphics** course at **Sapienza University of Rome**. In this game, players use a virtual **slingshot** to eliminate aggressive hornets while carefully avoiding friendly fireflies that illuminate the scene. The game challenges the player's reflexes and attention to detail, blending gameplay with basic interactive graphics principles.


This repository contains the finalized version submitted for the course, complete with polished assets and core mechanics.
---

## 🎮 Gameplay Overview

- **Goal**: Shoot hornets using the slingshot to score points.
- **Avoid**: Hitting fireflies — doing so results in a penalty. They are the source of light at night to see the hornets.
- **Mechanics**:
  - Launch slime projectiles at hornets using the slingshot.
  - Hold <kbd>Shift</kbd> and use the arrow keys to aim. Release <kbd>Shift</kbd> to fire.
  - If your slime hits the ground, a new projectile automatically spawns at the slingshot.

---

## 📚 Project Information

- **Course**: Interactive Graphics  
- **University**: Sapienza University of Rome  
- **Academic Year**: 2024–2025  
- **Developer**: Ehsan Kiakojouri  
- **Professor**: Prof. Paolo Russo

---

## 🛠️ Technologies Used

- WebGL  
- JavaScript / HTML5 / CSS3  
- Blender (for asset integration and optimization)

---

## 🖼️ 3D Assets & Attribution

- **Firefly Model**  
  [Firefly by alexguirre on Sketchfab](https://sketchfab.com/3d-models/firefly-111cc8dc99c84940a8bd4dc83a4f430a)  
  License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

- **Hornet Model**  
  [Bee by lam3d on Sketchfab](https://sketchfab.com/3d-models/bee-5d046a1e1c5141eabaff4c5c4ccc5d34)  
  License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

- **Slingshot Model**  
  [Gorilla Tag Slingshots by Proto on Sketchfab](https://sketchfab.com/3d-models/gorilla-tag-slingshots-75edb84dcbe24e53a78bd62fe668bb6f)  
  License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

- **Slime Projectile**  
  [Slime 1 by CloudSlime on Sketchfab](https://sketchfab.com/3d-models/slime-1-8b44e345b4a94818837e953a06e571bf)  
  License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)  
  *Note: Mesh decimated in Blender for smoother in-game performance.*

All assets are used under their respective licenses and credited properly.

---

## 🚀 Running the Game

The game is web-based and can be run in a modern browser.

### Running Locally
1. Open a terminal in the `Light_or_String` directory and start a simple HTTP server, for example:
   ```bash
   python3 -m http.server
   ```
   or `npx http-server`.
2. Navigate to `http://localhost:8000` (or the port shown in the terminal) and open `index.html`.
3. Use the slingshot controls described above to play.

The project relies on WebGL and has been tested in the latest versions of Chrome and Firefox.