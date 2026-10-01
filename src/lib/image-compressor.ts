/**
 * Smart Client-side Image Compressor
 * Nén ảnh biên bản giao nhận/ký nhận ngay tại thiết bị trước khi upload
 * Giảm dung lượng từ 5-10MB xuống còn 150-300KB nhưng vẫn sắc nét, đọc rõ chữ ký và con số.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default: 0.78)
  format?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  compressionRatioPercent: number;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1800,
    maxHeight = 1800,
    quality = 0.78,
    format = 'image/webp',
  } = options;

  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(new Error('Không thể đọc file ảnh: ' + err));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = (err) => reject(new Error('Không thể nạp dữ liệu ảnh: ' + err));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Tính toán kích thước mới giữ nguyên tỉ lệ
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Trình duyệt không hỗ trợ Canvas 2D'));
          }

          // Khử răng cưa và làm mịn ảnh để chữ viết tay và chữ ký sắc nét
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Vẽ nền trắng (đặc biệt cần thiết nếu ảnh gốc là PNG trong suốt)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Vẽ ảnh lên canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Thử xuất ra WebP, nếu không hỗ trợ sẽ fallback sang JPEG
          let outputFormat = format;
          let dataUrl = canvas.toDataURL(outputFormat, quality);
          if (!dataUrl.startsWith(`data:${outputFormat}`)) {
            outputFormat = 'image/jpeg';
            dataUrl = canvas.toDataURL(outputFormat, quality);
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Lỗi chuyển đổi canvas sang Blob'));
              }

              const compressedSizeKb = Math.round(blob.size / 1024);
              const compressionRatioPercent = originalSizeKb > 0
                ? Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100)
                : 0;

              // Tạo File mới với tên file phù hợp đuôi định dạng
              const extension = outputFormat === 'image/webp' ? 'webp' : 'jpg';
              const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const newFileName = `${baseName}_compressed.${extension}`;
              const compressedFile = new File([blob], newFileName, {
                type: outputFormat,
                lastModified: Date.now(),
              });

              resolve({
                file: compressedFile,
                blob,
                dataUrl,
                originalSizeKb,
                compressedSizeKb,
                compressionRatioPercent: Math.max(0, compressionRatioPercent),
                width,
                height,
              });
            },
            outputFormat,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Tiện ích nén ảnh tỉ lệ 1:1 vuông và tối ưu dung lượng trong khoảng 150KB - 300KB (WebP)
 * Phục vụ cho tính năng Công khai ảnh suất ăn hàng ngày
 */
export async function cropAndCompressToSquareWebP(
  file: File,
  targetMinKb: number = 150,
  targetMaxKb: number = 300,
  targetResolution: number = 1080
): Promise<{ file: File; previewUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetResolution;
          canvas.height = targetResolution;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Không thể khởi tạo Canvas 2D"));
          }

          // Cắt vuông từ tâm ảnh (Center Crop 1:1)
          const sw = img.width;
          const sh = img.height;
          const minDim = Math.min(sw, sh);
          const sx = (sw - minDim) / 2;
          const sy = (sh - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetResolution, targetResolution);

          // Nén lũy tiến sang WebP để đạt dung lượng mục tiêu 150KB - 300KB
          let quality = 0.85;
          let blob: Blob | null = null;

          // Thử nghiệm giảm chất lượng nếu ảnh vượt quá targetMaxKb
          for (let step = 0; step < 6; step++) {
            blob = await new Promise<Blob | null>((res) =>
              canvas.toBlob((b) => res(b), "image/webp", quality)
            );

            if (!blob) break;
            const curKb = blob.size / 1024;

            if (curKb <= targetMaxKb && curKb >= targetMinKb) {
              break; // Đã đạt trong khoảng lý tưởng
            } else if (curKb > targetMaxKb) {
              quality -= 0.1;
              if (quality < 0.4) break;
            } else {
              // Nếu ảnh quá nhỏ (< 150KB) thì tăng chất lượng nếu còn tăng được
              if (quality < 0.95) {
                quality += 0.08;
              } else {
                break;
              }
            }
          }

          if (!blob) {
            return reject(new Error("Lỗi nén ảnh sang WebP"));
          }

          const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          const compressedFile = new File([blob], cleanName, { type: "image/webp" });
          const previewUrl = URL.createObjectURL(blob);
          const sizeKb = Math.round(blob.size / 1024);

          resolve({ file: compressedFile, previewUrl, sizeKb });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Không thể đọc định dạng ảnh"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Không thể mở file"));
    reader.readAsDataURL(file);
  });
}
