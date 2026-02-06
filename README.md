# Blades-of-Grass
Real-Time Procedural Grass in Babylon.js

Blades of Grass is a real-time procedural grass renderer built with Babylon.js, JavaScript and GLSL.
Instead of relying on external 3D models or heavy textures, this project generates and animates an entire grass field from scratch using:
- Custom CPU-side mesh generation
- GPU-side vertex and fragment shaders
- Noise-based wind animation
The result is an animated patch of ~50,000 blades of grass, swaying in the wind with gradient coloring and efficient rendering.

Goals
- Create a real-time grass animation without pre-made assets
- Focus on shader programming and custom mesh generation
- Simulate natural wind-driven motion in a visually convincing way
- Keep the implementation efficient enough to handle hundreds of thousands of blades

Key Features
- Procedural grass generation
   - Each blade is generated procedurally on the CPU
   - All baldes are combined into a single mesh to avoid thousands of draw calls
- Noise-based wind simulation
   - A custom vertex shader uses a 2D noise function to simulate wind
   - Sway is applied more strongly at the tips than at the base of each blade
- Gradient-based blade shading
   - A fragment shader applies a color gradient from darker at the base to brighter at the tip
   - This adds depth and realism without relying on complex textures.
 
Technical Overview
Engine & Technologies
- Engine: Babylon.js
- Language: JavaScript
- Shaders: GLSL
- Rendering: Single custom mesh with custom vertex/fragment shaders

Geometry Generation
On the CPU, we procedurally construct a patch of grass:
  - Blade Count: ~750,000
  - Segments per blade: 10 (triangles combined to create one large triangle)
  
For each blade:
  1) Sample a random base position (x, z) within a rectangular patch
  2) Randomize height and width within small ranges so blades are not identical
  3) Generate vertices along the height (segments + 1 levels), with width tapering towards the tip
  4) Store:
    - position (vertex coordinates)
    - bladeHeight (per-vertex attribute, same for all vertices of a blade)
  5) Build indices to form triangles between those vertices

All blades share:
  - One big vertex buffer for positions
  - One index buffer for all triangles
  - One custom attribute (bladeHeight) attatched as a VertexBuffer
  
This allows the GPU to treat the entire field as a single mesh, which is crucial for performance.

Shaders
  Vertex Shader (Grass Animation & Lighting)
    Responsibilities:
      - Compute wind-induced sway using a noise function
      - Bend blades more at the tip than base
      - Compute a basic lighting factor based on a reconstructed normal and the light direction
      - Pass a height-based gradient value to the fragment shader

Fragment Shader (Coloring)
  Responsibilites:
    - Apply a vertical color gradient per blade:
      - Darker near the base
      - Brighter and more vibrant near the tip
   - Apply basic directional lighting so front appears brighter than back

Challenges & Learnings
Wind Motion
  One of the biggest challenges was making the animation of the grass look natural:
    - Early versions felt stiff or as if the blades were jumping around in their animation
    - Adding noise-based variation per position, plus bending that increases toward the tip made the motion appear to be much more natural


Performance Considerations
  Rendering 750,000 individual meshes is a poor approach:
    - Combining all blades into one mesh with shared buffers was key to maintaining performance
    - Pushing animation to the GPU via shaders avoided CPU-side per-frame updates to vertex data

We ended up with a solution that's both visually convincing and reasonably efficient for real-time rendering in a browser.

Credits & References:
Team: Jack Hertz, Helena Servin-DeMarrais, Michael Kobs, Ava Ferrentino
GPUOpen - Procedural Grass Rendering: Material used to get the ball rolling on efficient grass rendering techniques.
Patricio Gonzalez Vivo (GLSL Noise): Used their 2D noise function to assist in the animation of grass blades.
