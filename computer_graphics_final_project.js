export const createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.8, 0.9, 1.0);

	const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, 1, 20, new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);

    //lighting
    var light = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    light.position = new BABYLON.Vector3(5, 10, 5);
    light.intensity = 1.2;

    //ground
    var ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 25, height: 25}, scene);
    ground.material = new BABYLON.StandardMaterial("groundmaterial", scene);
    ground.material.diffuseColor = new BABYLON.Color3(0, 0.2, 0);

    //Skybox
    var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMat", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;


    //our vertex shader for noise and sway creation and amount
    BABYLON.Effect.ShadersStore["grassVertexShader"] = `
        precision highp float;
        attribute vec3 position;
        attribute float bladeHeight;
        uniform mat4 worldViewProjection;
        uniform float time;
        uniform vec3 lightDirection;
        varying float vLighting;

        varying float gradient;

        // https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
        
        float rand(vec2 n) { 
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }
        //noise function for sway variation
        float noise(vec2 p) {
            vec2 ip = floor(p);
            vec2 u = fract(p);
            u = u*u*(3.0 - 2.0*u);
            float a = rand(ip);
            float b = rand(ip + vec2(1.0, 0.0));
            float c = rand(ip + vec2(0.0, 1.0));
            float d = rand(ip + vec2(1.0, 1.0));
            float res = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            return res * res;
        }


        void main() {
            //compute sample position for wind-like motion
            vec2 samplePos = vec2(
                position.x * 0.5 + time * 0.6,
                position.z * 0.5 + time * 0.6
            );
            float n = noise(samplePos);

            float swayAmt = 0.6; //increased this
            //tips of the blades sway more than the bases
            float t = position.y / bladeHeight;
            float bend = t * t;
            float sway = n * swayAmt * bend;

            //offset x for sway effect
            vec3 newPos = position;
            newPos.x += sway;

            gradient = newPos.y;

            //recompute a simple normal for lighting
            vec3 normal = normalize(vec3(-sway, 1.0, 0.0));
            vLighting = max(dot(normal, -lightDirection), 0.0);

            gl_Position = worldViewProjection * vec4(newPos, 1.0);
        }
    `;
    //our fragment shader to add gradient from vertex shader
    BABYLON.Effect.ShadersStore["grassFragmentShader"] = `
        precision highp float;
        //varying vec2 vUV;
        //varying float vLighting;

        varying float gradient;

        const vec4 colorTips = vec4(0.3, 0.8, 0.0, 1.0);
        const vec4 colorBottoms = vec4(0.3, 0.3, 0.1, 1.0);

        void main() {
            //add color based on gradient from vertex shader
            vec4 color = mix(colorBottoms, colorTips, gradient);

            gl_FragColor = vec4(color);
        }
    `;

    //shader material
    var shaderMaterial = new BABYLON.ShaderMaterial("shader", scene, {
        vertex: "grass", fragment: "grass"
    }, {
        //attributes: ["position", "uv", "bladeHeight"],
        attributes: ["position", "bladeHeight"],
        uniforms:   ["worldViewProjection", "time", "lightDirection"]
    });

    //building grass geometry over a rectangle patch
    const bladeCount   = 50000;
    const segments     = 10;
    const patchWidth   = 25; 
    const patchDepth   = 25;
    
    const positions    = [];
    const bladeHeights = [];
    const indices      = [];
    let   vertexOffset = 0;

    for (let i = 0; i < bladeCount; i++) {
        //random base position in the patch
        const baseX = (Math.random() - 0.5) * patchWidth;
        const baseZ = (Math.random() - 0.5) * patchDepth;
        //random height and width for each blade
        const height = 0.7 + Math.random() * 0.6;
        const width  = 0.10 + Math.random() * 0.02;

        //create vertices along each height of the blades
        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            const y = t * height;
            const w = width * (1.0 - t);

            positions.push(baseX - w/2, y, baseZ);
            bladeHeights.push(height);

            positions.push(baseX + w/2, y, baseZ);
            bladeHeights.push(height);
        }
        //create triangles (indices) for each blade
        for (let j = 0; j < segments; j++) {
            const idx = vertexOffset + j*2;
            indices.push(idx, idx+1, idx+2, idx+1, idx+3, idx+2);
        }
        vertexOffset += (segments + 1) * 2;
    }

    //create grass mesh and apply geometry to it
    const grassMesh = new BABYLON.Mesh("grass", scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices   = indices;
    vertexData.applyToMesh(grassMesh);

    const bladeHeightBuffer = new BABYLON.Buffer(engine, bladeHeights, false, 1);
    grassMesh.setVerticesBuffer(new BABYLON.VertexBuffer(
        engine, bladeHeightBuffer, "bladeHeight", false, false, 1
    ));
    grassMesh.material = shaderMaterial;
    //removing back face culling
    shaderMaterial.backFaceCulling = false;

    //animate grass
    scene.registerBeforeRender(() => {
        const t = performance.now() * 0.002;
        shaderMaterial.setFloat("time", t);
        shaderMaterial.setVector3("lightDirection", light.direction.normalize());
    });

    return scene;
};
