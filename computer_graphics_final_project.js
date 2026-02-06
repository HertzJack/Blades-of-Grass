export const createScene = function () {
    //create scene
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.8, 0.9, 1.0);

    //camera
	const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI/2, 1, 20, new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);

    //sky fill for lighting
    const skyFill = new BABYLON.HemisphericLight(
        "skyFill", new BABYLON.Vector3(0, 1, 0), scene);
    skyFill.intensity = 0.5; 
    skyFill.groundColor = new BABYLON.Color3(0.01, 0.01, 0.15); // earthy bounce
    
    //direct lighting
    var light = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.6, -1.0, -0.2).normalize(), scene);
    light.position = new BABYLON.Vector3(5, 10, 5);
    light.intensity = 1.25;

    //dimensions of patch
    const patchWidth = 25; 
    const patchDepth = 25;

    //ground
    var ground = BABYLON.MeshBuilder.CreateGround("ground", {width: patchWidth, height: patchDepth}, scene);
    ground.material = new BABYLON.StandardMaterial("groundmaterial", scene);
    ground.material.diffuseColor = new BABYLON.Color3(0.11, 0.06, 0.01);
    ground.material.backFaceCulling = false;


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
        attribute vec3 position;    //positions of blade vertices
        attribute float bladeHeight;//height of each grass blade

        uniform mat4 worldViewProjection;
        uniform float time;
        uniform vec3 lightDirection;

        varying float gradient;

        //https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
        
        float rand(vec2 n) { 
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }
        //noise function for sway variation from github
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

            float swayAmt = 0.6; //controls sway strength
            float t = position.y / bladeHeight;
            //tips of the blades sway exponentially more than the bases
            float bend = t * t;
            float sway = n * swayAmt * bend;

            //offset x for sway effect
            vec3 newPos = position;
            newPos.x += sway;

            //varying used for coloring later
            t = clamp(t, 0.0, 1.0);
            gradient = t;

            gl_Position = worldViewProjection * vec4(newPos, 1.0);
        }
    `;
    //our fragment shader to add gradient from vertex shader
    BABYLON.Effect.ShadersStore["grassFragmentShader"] = `
        precision highp float;

        uniform vec3 lightDirection;

        uniform float skyIntensity;
        uniform vec3 skyColor;
        uniform vec3 groundColor;

        varying float gradient;

        const vec4 colorTips = vec4(0.1, 0.6, 0.0, 1.0);
        const vec4 colorBottoms = vec4(0.3, 0.4, 0.1, 1.0);

        void main() {
            //clamp between [0,1]
            float t = clamp(gradient, 0.0, 1.0);
            vec3 skyFill = mix(groundColor, skyColor, t) * skyIntensity;
            //blend bottoms and tips color
            vec4 color = mix(colorBottoms, colorTips, t);

            vec3 L = normalize(-lightDirection);
            vec3 N = vec3(0.0, 0.0, 1.0);
            if (!gl_FrontFacing) N = -N; //opposite for backs of blades

            float diffuse = max(dot(N, L), 0.0);
            diffuse = pow(diffuse, 0.8);

            float backMul = gl_FrontFacing ? 1.0 : 0.45;

            float ambientFront = 0.25;
            float ambientBack = 0.10;
            float ambient = gl_FrontFacing ? ambientFront : ambientBack;

            float lightAmt = clamp(ambient + backMul * diffuse, 0.0, 1.0);

            float colorBase = mix(0.65, 1.0, t);

            vec3 lit = color.rgb * lightAmt * colorBase;
            lit += color.rgb * skyFill * (gl_FrontFacing ? 1.0 : 0.5);

            gl_FragColor = vec4(lit, color.a);
        }
    `;

    //shader material
    var shaderMaterial = new BABYLON.ShaderMaterial("shader", scene, {
        vertex: "grass", fragment: "grass"
    }, {
        //attributes: ["position", "uv", "bladeHeight"],
        attributes: ["position", "bladeHeight"],
        uniforms:   ["worldViewProjection", "time", "lightDirection",
                    "skyIntensity", "skyColor", "groundColor"]
    });

    //building grass geometry over a rectangle patch
    const bladeCount = 50000;
    const segments = 10;
    
    const positions = [];
    const bladeHeights = [];
    const indices = [];
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
        shaderMaterial.setFloat("skyIntensity", skyFill.intensity);
        shaderMaterial.setColor3("skyColor", skyFill.diffuse);
        shaderMaterial.setColor3("groundColor", skyFill.groundColor);
    });

    return scene;
};
