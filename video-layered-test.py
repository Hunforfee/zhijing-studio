import tempfile
from pathlib import Path
import unittest
import numpy as np
import importlib.util

spec = importlib.util.spec_from_file_location('layered', Path(__file__).with_name('video-layered.py'))
layered = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layered)
cv2 = layered.cv2


class LayeredTests(unittest.TestCase):
    def test_breeze_never_changes_product_pixels_and_product_uses_rigid_camera(self):
        with tempfile.TemporaryDirectory(prefix='zhijing-layered-') as folder:
            y, x = np.indices((240, 320))
            image = np.stack([(x * 3 % 255), (y * 5 % 255), ((x + y) % 255)], axis=2).astype(np.uint8)
            file = Path(folder) / 'frame-1.png'
            layered.write_image(file, image)
            config = {'subject': [[0, .45], [1, .45], [1, 1], [0, 1]],
                      'ambient': [[0, 0], [1, 0], [1, 1], [0, 1]],
                      'foreground': [[.05, .05], [.2, .05], [.2, .2], [.05, .2]]}
            layers = layered.prepare(file, config, 320, 240)
            self.assertTrue(np.all(layers['ambient'][layers['subject'] > .001] == 0))
            a = layered.render_frame(layers, .25, 1, True)
            b = layered.render_frame(layers, .25, 1, False)
            matrix = layered.camera_matrix(320, 240, 1, .25, 1)
            alpha = layered.warp(layers['subject'], matrix, 320, 240, True)
            self.assertTrue(np.array_equal(a[alpha == 1], b[alpha == 1]))
            self.assertGreater(np.abs(a.astype(int) - b.astype(int)).sum(), 0)
            expected = layered.warp(layers['image'], matrix, 320, 240)
            self.assertTrue(np.array_equal(a[alpha == 1], expected[alpha == 1]))
            back_matrix = layered.camera_matrix(320, 240, .25, 1, 1)
            near_matrix = layered.camera_matrix(320, 240, 1.45, 1, 1)
            self.assertFalse(np.array_equal(back_matrix, near_matrix))
            self.assertEqual(matrix[0, 1], 0)
            self.assertEqual(matrix[1, 0], 0)
            self.assertEqual(matrix[0, 0], matrix[1, 1])


if __name__ == '__main__':
    unittest.main()
