async function activateXR() {
  //----- Step 1 -------//
  // Add a canvas element and initialize a WebGL context that is compatible with WebXR.
  const canvas = document.createElement("canvas");

  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  //----- Step 2 -------//
  // Add the necessary variables in one spot for clear code

  //create Three.js scene that will be used in AR
  const scene = new THREE.Scene();

  // Add a 'clock' var for animations
  let clock = new THREE.Clock();

  // Add a mixer for animation frames
  const mixers = [];

  var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 300, 0);
  scene.add(hemiLight);

  var dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(75, 300, 0);
  scene.add(dirLight);

  //----- step 3 -------//

  // Set up the WebGLRenderer, which handles rendering to the session's base layer.
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = false;

  // The API directly updates the camera matrices.
  // Disable matrix auto updates so three.js doesn't attempt
  // to handle the matrices independently.
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;

  // ----- step 4 -------//

  // Initialize a WebXR session using "immersive-ar".
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    // optionalFeatures: ["dom-overlay"], //////////////////////////
  });
  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  // A 'local' reference space has a native origin that is located
  // near the viewer's position at the time the session was created.
  const referenceSpace = await session.requestReferenceSpace("local");

  // Create another XRReferenceSpace that has the viewer as the origin.
  const viewerSpace = await session.requestReferenceSpace("viewer");
  // Perform hit testing using the viewer as origin.
  const hitTestSource = await session.requestHitTestSource({
    space: viewerSpace,
  });

  //Use the model loader from the previous step to load a targeting reticle and a sunflower from the web.
  const loader = new THREE.GLTFLoader();
  let reticle;

  let flower;
  let model;
  loader.load(
    "https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf",
    function (gltf) {
      reticle = gltf.scene;
      reticle.visible = false;
      scene.add(reticle);
    }
  );

  session.addEventListener("select", (event) => {
    loader.load("models/Demon/Demon.gltf", function (gltf) {
      model = gltf.scene;

      //scale of model
      model.scale.multiplyScalar(10);

      //copy position target. Use it for position model
      model.position.copy(reticle.position);

      //add rotation to model. Model faces camera at start.
      model.rotation.y += 15;

      const animation = gltf.animations[0];
      const mixer = new THREE.AnimationMixer(model);
      mixers.push(mixer);

      const action = mixer.clipAction(animation);
      action.play();

      scene.add(model);
    });
  });

  //----- step 5 -------//
  // Create a render loop that allows us to draw on the AR view.
  const onXRFrame = (time, frame) => {
    // Queue up the next draw request.
    session.requestAnimationFrame(onXRFrame);

    // Bind the graphics framebuffer to the baseLayer's framebuffer
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      session.renderState.baseLayer.framebuffer
    );

    // Retrieve the pose of the device.
    // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
    const pose = frame.getViewerPose(referenceSpace);
    if (pose) {
      // In mobile AR, we only have one view.
      const view = pose.views[0];

      const viewport = session.renderState.baseLayer.getViewport(view);
      renderer.setSize(viewport.width, viewport.height);

      // Use the view's transform matrix and projection matrix to configure the THREE.camera.
      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0 && reticle) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);
        reticle.visible = true;
        reticle.position.set(
          hitPose.transform.position.x,
          hitPose.transform.position.y,
          hitPose.transform.position.z
        );
        reticle.updateMatrixWorld(true);
      }

      // Render the scene with THREE.WebGLRenderer.
      renderer.render(scene, camera);
    }
  };

  renderer.setAnimationLoop(() => {
    animate();
  });

  function animate() {
    const delta = clock.getDelta();

    for (const mixer of mixers) {
      mixer.update(delta);
    }

    renderer.render(scene, camera);
  }
  session.requestAnimationFrame(onXRFrame);
}
