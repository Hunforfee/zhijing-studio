"""Local, rigid-layer camera renderer. No model calls or network access."""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).parent / 'tools' / 'video-python'))
import cv2
import numpy as np


def read_image(path):
    result = cv2.imdecode(np.frombuffer(Path(path).read_bytes(), np.uint8), cv2.IMREAD_COLOR)
    if result is None:
        raise ValueError('Invalid storyboard frame')
    return result


def write_image(path, image):
    ok, encoded = cv2.imencode('.png', image)
    if not ok:
        raise ValueError('Cannot save layer preview')
    Path(path).write_bytes(encoded.tobytes())


def polygon_mask(points, width, height):
    mask = np.zeros((height, width), np.uint8)
    if points:
        vertices = np.round(np.array(points) * [width - 1, height - 1]).astype(np.int32)
        cv2.fillPoly(mask, [vertices], 255)
    return mask


def cover(image, width, height):
    scale = max(width / image.shape[1], height / image.shape[0])
    resized = cv2.resize(image, (math.ceil(image.shape[1] * scale), math.ceil(image.shape[0] * scale)), interpolation=cv2.INTER_LANCZOS4)
    x, y = (resized.shape[1] - width) // 2, (resized.shape[0] - height) // 2
    return resized[y:y + height, x:x + width]


def fill_hidden(image, mask):
    # Only hidden background pixels are replaced. Visible room pixels are original.
    height, width = mask.shape
    scale = min(1, 640 / max(height, width))
    small_size = (max(2, round(width * scale)), max(2, round(height * scale)))
    small_image = cv2.resize(image, small_size, interpolation=cv2.INTER_AREA)
    small_mask = cv2.resize(mask, small_size, interpolation=cv2.INTER_NEAREST)
    restored = cv2.inpaint(small_image, small_mask, 4, cv2.INPAINT_TELEA)
    restored = cv2.resize(restored, (width, height), interpolation=cv2.INTER_CUBIC)
    return np.where(mask[:, :, None] > 0, restored, image).astype(np.uint8)


def prepare(frame_path, config, width, height):
    original = read_image(frame_path)
    oh, ow = original.shape[:2]
    subject_source = polygon_mask(config['subject'], ow, oh)
    foreground_source = polygon_mask(config.get('foreground', []), ow, oh)
    ambient_source = polygon_mask(config.get('ambient', []), ow, oh)
    image = cover(original, width, height)
    subject = cover(cv2.cvtColor(subject_source, cv2.COLOR_GRAY2BGR), width, height)[:, :, 0]
    subject = np.where(subject > 127, 255, 0).astype(np.uint8)
    # A safety margin keeps foreground and breeze away from product boundaries.
    protected = cv2.dilate(subject, np.ones((9, 9), np.uint8))
    foreground = cover(cv2.cvtColor(foreground_source, cv2.COLOR_GRAY2BGR), width, height)[:, :, 0]
    foreground[protected > 0] = 0
    ambient = cover(cv2.cvtColor(ambient_source, cv2.COLOR_GRAY2BGR), width, height)[:, :, 0]
    ambient[protected > 0] = 0
    foreground = cv2.GaussianBlur(foreground, (0, 0), max(1, width / 450))
    ambient = cv2.GaussianBlur(ambient, (0, 0), max(1, width / 250))
    ambient[protected > 0] = 0
    foreground[protected > 0] = 0
    foreground_hole = cv2.dilate(np.where(foreground > 3, 255, 0).astype(np.uint8), np.ones((7, 7), np.uint8))
    hidden = cv2.bitwise_or(subject, foreground_hole)
    background = fill_hidden(image, hidden)
    # Product interior remains exactly from the source, with only 1px edge feather.
    alpha = cv2.GaussianBlur(subject, (0, 0), .65).astype(np.float32) / 255
    return {'image': image, 'background': background, 'subject': alpha,
            'foreground': foreground.astype(np.float32) / 255,
            'ambient': ambient.astype(np.float32) / 255}


def camera_matrix(width, height, depth, t, index):
    ease = t * t * (3 - 2 * t)
    # Each plane moves as a rigid whole. Never warp a duvet mesh or its texture.
    zoom = 1.045 + .028 * depth * ease
    dx = width * .010 * depth * ease * (1 if index % 2 == 0 else -1)
    dy = height * .0035 * depth * ease if index % 3 == 2 else 0
    return np.float32([[zoom, 0, width * (1 - zoom) / 2 + dx],
                       [0, zoom, height * (1 - zoom) / 2 + dy]])


def warp(image, matrix, width, height, mask=False):
    return cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_LINEAR if mask else cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_CONSTANT if mask else cv2.BORDER_REFLECT_101)


def composite(base, image, alpha):
    return cv2.blendLinear(image, base, alpha, 1 - alpha)


def render_frame(layers, t, index, breeze=True):
    height, width = layers['image'].shape[:2]
    back_matrix = camera_matrix(width, height, .25, t, index)
    product_matrix = camera_matrix(width, height, 1, t, index)
    near_matrix = camera_matrix(width, height, 1.45, t, index)
    canvas = warp(layers['background'], back_matrix, width, height)
    if breeze and np.any(layers['ambient']):
        # Local leaf/curtain movement, not deformation of the photographed fabric.
        wind = back_matrix.copy()
        wind[:, 2] += np.array([math.sin(t * math.pi * 2) * 1.3, math.sin(t * math.pi * 1.6) * .7]) * min(width, height) / 1080
        patch = warp(layers['image'], wind, width, height)
        alpha = warp(layers['ambient'], wind, width, height, True)
        canvas = composite(canvas, patch, alpha)
    product = warp(layers['image'], product_matrix, width, height)
    alpha = warp(layers['subject'], product_matrix, width, height, True)
    canvas = composite(canvas, product, alpha)
    if np.any(layers['foreground']):
        front = warp(layers['image'], near_matrix, width, height)
        near_alpha = warp(layers['foreground'], near_matrix, width, height, True)
        # Foreground edge cannot cross in front of protected product pixels.
        near_alpha[alpha > .01] = 0
        canvas = composite(canvas, front, near_alpha)
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8'))
    directory = Path(args.config).resolve().parent
    index, duration, width, height = [config[k] for k in ['index', 'duration', 'width', 'height']]
    cv2.setNumThreads(2)
    layers = prepare(directory / f'frame-{index + 1}.png', config['layers'], width, height)
    write_image(directory / f'layer-{index + 1}-subject.png', np.round(layers['subject'] * 255).astype(np.uint8))
    write_image(directory / f'layer-{index + 1}-background.png', layers['background'])
    temporary = directory / f'layered-{index + 1}.partial.mp4'
    command = [args.ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pixel_format', 'bgr24',
               '-video_size', f'{width}x{height}', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264',
               '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(temporary)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        count = duration * 30
        for n in range(count):
            frame = render_frame(layers, n / max(1, count - 1), index, config['layers'].get('breeze', True))
            if n in [0, count // 2, count - 1]:
                write_image(directory / f'layered-{index + 1}-frame-{n}.png', frame)
            process.stdin.write(frame.tobytes())
        process.stdin.close()
        error = process.stderr.read()
        if process.wait() != 0:
            raise RuntimeError('Layered video encoding failed: ' + error.decode('utf-8', errors='replace')[:250])
        os.replace(temporary, directory / f'shot-{index + 1}.mp4')
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait()


if __name__ == '__main__':
    main()
