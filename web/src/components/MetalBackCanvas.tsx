import {useEffect, useRef} from 'react';

/** Imperative pointer coordinates avoid React renders while tilting the card. */
export interface MetalSurfaceController {
  setTilt(x: number, y: number): void;
  setPointer(x: number, y: number, active: boolean): void;
  setGold(liked: boolean): void;
}

/**
 * Real anisotropic metallic reflection, with a bundled CC0 studio HDRI.
 * WebGL runs only while the reverse face is open. The DOM handles lettering,
 * flipping, focus and dismissal; this canvas is strictly decorative.
 *
 * The plane remains flat in local canvas space. Its environment is rotated by
 * the inverse of the CSS card tilt, so reflections change with world-space
 * orientation without applying the card's CSS transform a second time.
 */
export function MetalBackCanvas({liked, onController}: {
  liked: boolean;
  onController(controller: MetalSurfaceController | null): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef(onController);
  const materialHandle = useRef<MetalSurfaceController | null>(null);
  controller.current = onController;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let release: (() => void) | undefined;
    element.dataset.metalStatus = 'loading';

    const setup = async () => {
      const THREE = await import('three');
      const [{RGBELoader}, {RoomEnvironment}] = await Promise.all([
        import('three/addons/loaders/RGBELoader.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ]);
      if (disposed) return;
      element.dataset.metalStatus = 'initializing';

      let renderer: import('three').WebGLRenderer | undefined;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: element, alpha: true, antialias: true, powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        });
      } catch {
        element.dataset.metalStatus = 'fallback';
        // WebGL unsupported, GPU unavailable, or browser context limit reached.
        return;
      }
      if (disposed) { renderer.dispose(); return; }

      element.dataset.metalStatus = 'renderer-ready';
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      // The HDR is a subdued studio fill; local illumination handles the
      // small specular focal point next to the pointer.
      scene.environmentIntensity = 0.90;
      // PBR flat plates NEED a perspective view: orthographic rays have the
      // same direction at every pixel and thus sample the same HDR reflection.
      // Perspective makes the studio softboxes visible across a flat surface.
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
      camera.position.z = 3;
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.MeshPhysicalMaterial({
        color: liked ? 0xd3a34f : 0xbac1cb,
        metalness: 1,
        roughness: 0.26,
        anisotropy: 0.06,
        anisotropyRotation: Math.PI / 2,
        envMapIntensity: 1.08,
        side: THREE.FrontSide,
      });
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      // A real local light produces a physically evaluated PBR highlight.
      // Kept separate from HDR ambient reflections to avoid broad sweeping
      // studio bands when moving the pointer over the metal.
      const focusLight = new THREE.SpotLight(0xfffaf2, 0, 8, Math.PI / 12, 0.96, 2);
      const focusTarget = new THREE.Object3D();
      focusLight.position.set(0, 0, 2.7);
      focusTarget.position.set(0, 0, 0);
      focusLight.target = focusTarget;
      scene.add(focusLight, focusTarget);

      let hdr: import('three').DataTexture | undefined;
      let fallbackEnv: import('three').Texture | undefined;
      let fallbackPMREM: import('three').PMREMGenerator | undefined;
      let frame = 0;
      let resizeObserver: ResizeObserver | undefined;
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      // Pointer is normalized to [-.5, .5] on the card plane. Luminance
      // and position both ease, including when the mouse exits the card.
      let pointerX = 0;
      let pointerY = 0;
      let targetPointerX = 0;
      let targetPointerY = 0;
      let targetFocus = 0;
      let currentFocus = 0;
      let surfaceWidth = 2.18;
      let surfaceHeight = 2.18;
      let active = true;
      let environmentTexture: import('three').Texture | undefined;

      const render = () => {
        if (!active || disposed) return;
        currentX += (targetX - currentX) * .16;
        currentY += (targetY - currentY) * .16;
        pointerX += (targetPointerX - pointerX) * .18;
        pointerY += (targetPointerY - pointerY) * .18;
        currentFocus += (targetFocus - currentFocus) * .14;
        // A tight, feathered spotlight tracks the card's local pointer.
        // Position is offset from the target so a metal surface reflects
        // it into the viewer at approximately the pointed location.
        const px = pointerX * surfaceWidth;
        const py = -pointerY * surfaceHeight;
        focusTarget.position.set(px, py, 0);
        // A near-normal incidence minimizes the oblong pool created when
        // the light intersects the flat plate at a very steep angle.
        focusLight.position.set(px * 1.2, py * 1.2, 2.7);
        focusLight.intensity = currentFocus;
        // Near frontal appearance is selected so the HDR softboxes remain
        // visible at rest; pointer-driven yaw/pitch changes their reflection.
        scene.environmentRotation.set(
          .26 + currentY * -.22,
          -.54 + currentX * -.25,
          -.06 + currentX * .04,
          'XYZ',
        );
        if (environmentTexture && element.clientWidth && element.clientHeight) {
          renderer.render(scene, camera);
          element.dataset.metalStatus = 'rendered';
        }
        if (Math.abs(targetX - currentX) > .0006 || Math.abs(targetY - currentY) > .0006
          || Math.abs(targetPointerX - pointerX) > .0006
          || Math.abs(targetPointerY - pointerY) > .0006
          || Math.abs(targetFocus - currentFocus) > .015)
          frame = requestAnimationFrame(render);
        else frame = 0;
      };
      const schedule = () => {
        if (!active || disposed || frame) return;
        frame = requestAnimationFrame(render);
      };
      const sizes = () => {
        if (!active || disposed) return;
        const width = Math.max(1, element.clientWidth);
        const height = Math.max(1, element.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        // Fill the viewport exactly, including while resizing on mobile.
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
          * camera.position.z;
        surfaceWidth = 2 * halfHeight * camera.aspect;
        surfaceHeight = 2 * halfHeight;
        plane.scale.set(halfHeight * camera.aspect, halfHeight, 1);
        renderer.setSize(width, height, false);
        schedule();
      };
      // Note: use the width/height from layout, not the DOM transform-bound
      // getBoundingClientRect(), which changes during the 3D flip.
      resizeObserver = new ResizeObserver(sizes);
      resizeObserver.observe(element);

      const api: MetalSurfaceController = {
        setGold(gold) {
          material.color.set(gold ? 0xd3a34f : 0xbac1cb);
          focusLight.color.setHex(gold ? 0xfff0ce : 0xfffaf2);
          schedule();
        },
        setPointer(x, y, isActive) {
          targetPointerX = Math.max(-.5, Math.min(.5, x));
          targetPointerY = Math.max(-.5, Math.min(.5, y));
          targetFocus = isActive ? 8.0 : 0;
          schedule();
        },
        setTilt(x,y) {
          targetX = Math.max(-.5, Math.min(.5, x));
          targetY = Math.max(-.5, Math.min(.5, y));
          schedule();
        },
      };
      materialHandle.current = api;
      controller.current(api);
      api.setGold(liked);
      sizes();

      // Register cleanup before awaiting HDR loading; navigation cannot leak WebGL.
      release = () => {
        active = false;
        materialHandle.current = null;
        controller.current(null);
        if (frame) cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        scene.environment = null;
        scene.remove(focusLight, focusTarget);
        focusLight.dispose();
        geometry.dispose();
        material.dispose();
        hdr?.dispose();
        fallbackEnv?.dispose();
        fallbackPMREM?.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };

      const hdrLoader = new RGBELoader().setDataType(THREE.FloatType);
      try {
        // Bundled locally: an album card must never depend on a remote asset.
        const texture = await hdrLoader.loadAsync('/metal/studio_small_05_1k.hdr');
        if (disposed || !active) { texture.dispose(); return; }
        // The studio HDR includes an actual rectangular softbox. A specular
        // metal plate reproduces that box with its hard corners: exposure
        // compression cannot remove the geometry. Integrate its light energy
        // into a low-frequency, nearly isotropic bounce environment instead.
        // The local PBR spotlight below is now the *only* distinct light pool.
        // This retains a real radiance environment without any square imprints.
        const data = texture.image.data as Float32Array;
        const width = texture.image.width as number;
        const height = texture.image.height as number;
        const pixels = width * height;
        const ambient = [0, 0, 0];
        const floor = [.29, .30, .32];
        for (let i = 0; i < data.length; i += 4) {
          for (let channel = 0; channel < 3; channel++) {
            const value = Math.max(data[i + channel], floor[channel]);
            ambient[channel] += floor[channel]
              + 1.35 * (1 - Math.exp(-(value - floor[channel]) / 2.2));
          }
        }
        for (let channel = 0; channel < 3; channel++) {
          ambient[channel] = Math.max(.33, Math.min(.58, ambient[channel] / pixels));
        }
        for (let y = 0; y < height; y++) {
          const latitude = (y + .5) / height;
          // Only a subtle overhead-to-horizon variation, continuous across
          // azimuth; never a second shape resembling a lightbox.
          const level = .94 + .06 * Math.cos((latitude - .3) * Math.PI);
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
              data[index + channel] = ambient[channel] * level;
            }
          }
        }
        texture.needsUpdate = true;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        hdr = texture;
        environmentTexture = texture;
        scene.environment = environmentTexture;
        element.dataset.metalStatus = 'hdr-ready';
        schedule();
      } catch {
        if (disposed || !active) return;
        // Procedural studio lights, also works without network access.
        fallbackPMREM = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        fallbackEnv = fallbackPMREM.fromScene(room).texture;
        room.dispose();
        environmentTexture = fallbackEnv;
        scene.environment = fallbackEnv;
        element.dataset.metalStatus = 'room-ready';
        schedule();
      }

    };
    void setup().catch(error => {
      // CSS fallback stays visible if material initialization fails.
      if (!disposed) {
        element.dataset.metalStatus = 'fallback';
        console.warn('Metal material unavailable:', error);
      }
    });
    return () => {
      disposed = true;
      materialHandle.current = null;
      controller.current(null);
      release?.();
    };
  }, []);

  useEffect(() => {
    // Updating liked never allocates another WebGL context or reloads the HDR.
    materialHandle.current?.setGold(liked);
  }, [liked]);

  return <canvas ref={canvas} className="album-metal-canvas"
    data-metal-tone={liked ? 'gold' : 'silver'} aria-hidden="true"/>;
}
