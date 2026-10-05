// Mechanical sprite export: resample into a centered transparent game frame.
// The artwork itself is unchanged; padding keeps characters at crowd scale.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 5, let width = Int(args[3]), let height = Int(args[4]),
      let input = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(input, 0, nil) else {
    fatalError("Usage: pack-unit source.png output.png width height")
}
let iw = image.width, ih = image.height
let space = CGColorSpaceCreateDeviceRGB()
let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
var pixels = [UInt8](repeating: 0, count: iw * ih * 4)
var halfX = 1.0, halfY = 1.0
pixels.withUnsafeMutableBytes { buffer in
    let context = CGContext(data: buffer.baseAddress, width: iw, height: ih,
        bitsPerComponent: 8, bytesPerRow: iw * 4, space: space, bitmapInfo: info)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: iw, height: ih))
    for y in 0..<ih {
        for x in 0..<iw where buffer[(y * iw + x) * 4 + 3] > 48 {
            halfX = max(halfX, abs(Double(x) + 0.5 - Double(iw) / 2))
            halfY = max(halfY, abs(Double(y) + 0.5 - Double(ih) / 2))
        }
    }
}
// Body height stays around the central 40%; weapons may extend sideways.
let scale = min(Double(width) / Double(iw), Double(height) / Double(ih),
                Double(width) * 0.35 / halfX, Double(height) * 0.23 / halfY)
let dw = Double(iw) * scale, dh = Double(ih) * scale
let output = CGContext(data: nil, width: width, height: height,
    bitsPerComponent: 8, bytesPerRow: width * 4, space: space, bitmapInfo: info)!
output.interpolationQuality = .high
output.draw(image, in: CGRect(x: (Double(width) - dw) / 2,
                             y: (Double(height) - dh) / 2, width: dw, height: dh))
guard let final = output.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL,
          UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot create PNG") }
CGImageDestinationAddImage(destination, final, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Cannot save PNG") }
