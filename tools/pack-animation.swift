// Mechanical export of equal-width animation cells with one shared scale.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message+"\n").utf8))
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 6, let width = Int(args[3]), let height = Int(args[4]),
      let frames = Int(args[5]), frames > 1,
      let input = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(input, 0, nil), image.width >= frames else {
    fail("Usage: pack-animation source.png output.png frame-width frame-height frames")
}
let space = CGColorSpaceCreateDeviceRGB()
let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
var cells: [CGImage] = []
// Generated poses can extend beyond nominal cells. Split at transparent gaps
// so a long weapon or claw stays with its character, keeping nominal anchors.
var sourcePixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
var occupied = [Bool](repeating: false, count: image.width)
sourcePixels.withUnsafeMutableBytes { buffer in
    let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height,
        bitsPerComponent: 8, bytesPerRow: image.width * 4, space: space, bitmapInfo: info)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    for x in 0..<image.width {
        for y in 0..<image.height where buffer[(y * image.width + x) * 4 + 3] > 48 {
            occupied[x] = true
            break
        }
    }
}
var boundaries = [0]
var needsIsolation = false
for frame in 1..<frames {
    let nominal = frame * image.width / frames
    let radius = image.width / frames / 3
    let candidates = (max(1, nominal-radius)..<min(image.width-1, nominal+radius)).filter {
        !occupied[$0-1] && !occupied[$0] && !occupied[$0+1]
    }
    let boundary = candidates.min(by: { abs($0-nominal) < abs($1-nominal) }) ?? nominal
    if candidates.isEmpty { needsIsolation = true }
    boundaries.append(boundary)
}
boundaries.append(image.width)
// A diagonal rifle can share X coordinates with the next cape while the
// two silhouettes remain separate. Isolate complete connected silhouettes
// in that case; never cut a weapon at a vertical cell boundary.
var isolated: [CGImage] = []
if needsIsolation {
    let iw = image.width, ih = image.height, count = iw * ih
    var labels = [Int](repeating: -1, count: count)
    var groups: [[Int]] = []
    for start in 0..<count where sourcePixels[start * 4 + 3] > 48 && labels[start] < 0 {
        let label = groups.count
        var queue = [start], next = 0
        labels[start] = label
        while next < queue.count {
            let pixel = queue[next]; next += 1
            let x = pixel % iw, y = pixel / iw
            for yy in max(0,y-1)...min(ih-1,y+1) {
                for xx in max(0,x-1)...min(iw-1,x+1) {
                    let neighbor = yy * iw + xx
                    if labels[neighbor] < 0 && sourcePixels[neighbor * 4 + 3] > 48 {
                        labels[neighbor] = label; queue.append(neighbor)
                    }
                }
            }
        }
        groups.append(queue)
    }
    let ranked = groups.indices.sorted { groups[$0].count > groups[$1].count }
    guard ranked.count >= frames else { fail("Animation silhouettes touch; regenerate with larger gaps") }
    let main = Array(ranked.prefix(frames)).sorted {
        groups[$0].map { $0 % iw }.min()! < groups[$1].map { $0 % iw }.min()!
    }
    let smallest = main.map { groups[$0].count }.min()!
    guard smallest > count / (frames * 100), ranked.dropFirst(frames).allSatisfy({ groups[$0].count < smallest / 4 }) else {
        fail("Animation has ambiguous detached silhouettes; regenerate with larger gaps")
    }
    var owners = [Int](repeating: -1, count: groups.count)
    let anchors = (0..<frames).map { (Double($0)+0.5)*Double(iw)/Double(frames) }
    for (frame, group) in main.enumerated() {
        let xs = groups[group].map { $0 % iw }
        let center = Double(xs.reduce(0,+))/Double(xs.count)
        guard abs(center-anchors[frame]) < Double(iw)/Double(frames)*0.4,
              xs.max()!-xs.min()! < iw/frames*3/2 else {
            fail("Animation silhouettes cross or touch; regenerate with larger gaps")
        }
        owners[group] = frame
    }
    for group in groups.indices where owners[group] < 0 {
        let center = Double(groups[group].map { $0 % iw }.reduce(0,+))/Double(groups[group].count)
        owners[group] = anchors.indices.min { abs(anchors[$0]-center) < abs(anchors[$1]-center) }!
    }
    var pixelOwners = labels.map { $0 >= 0 ? owners[$0] : -1 }
    // Retain the original antialiasing around each complete silhouette.
    for pixel in 0..<count where sourcePixels[pixel*4+3] > 0 && pixelOwners[pixel] < 0 {
        let x = pixel % iw, y = pixel / iw
        var closest = Int.max, owner = -1
        for yy in max(0,y-3)...min(ih-1,y+3) {
            for xx in max(0,x-3)...min(iw-1,x+3) {
                let label = labels[yy*iw+xx], distance = (xx-x)*(xx-x)+(yy-y)*(yy-y)
                if label >= 0 && distance < closest { closest = distance; owner = owners[label] }
            }
        }
        pixelOwners[pixel] = owner >= 0 ? owner : anchors.indices.min { abs(anchors[$0]-Double(x)) < abs(anchors[$1]-Double(x)) }!
    }
    // Full-width masked cells preserve the original fixed root anchors.
    for frame in 0..<frames {
        var pixels = sourcePixels
        for pixel in 0..<count where pixelOwners[pixel] != frame {
            for channel in 0..<4 { pixels[pixel*4+channel] = 0 }
        }
        let result = pixels.withUnsafeMutableBytes { buffer -> CGImage in
            let context = CGContext(data: buffer.baseAddress, width: iw, height: ih,
                bitsPerComponent: 8, bytesPerRow: iw*4, space: space, bitmapInfo: info)!
            return context.makeImage()!
        }
        isolated.append(result)
    }
}
var halfX = 1.0, halfY = 1.0
var scale = Double.greatestFiniteMagnitude
for frame in 0..<frames {
    let left = needsIsolation ? 0 : boundaries[frame]
    let right = needsIsolation ? image.width : boundaries[frame+1]
    let anchor = (Double(frame)+0.5) * Double(image.width) / Double(frames)
    guard let cell = needsIsolation ? isolated[frame] : image.cropping(to: CGRect(x: left, y: 0, width: right-left, height: image.height)) else {
        fail("Cannot read animation cell")
    }
    cells.append(cell)
    let iw = cell.width, ih = cell.height
    var pixels = [UInt8](repeating: 0, count: iw * ih * 4)
    var visible = false
    pixels.withUnsafeMutableBytes { buffer in
        let context = CGContext(data: buffer.baseAddress, width: iw, height: ih,
            bitsPerComponent: 8, bytesPerRow: iw * 4, space: space, bitmapInfo: info)!
        context.draw(cell, in: CGRect(x: 0, y: 0, width: iw, height: ih))
        for y in 0..<ih {
            for x in 0..<iw where buffer[(y * iw + x) * 4 + 3] > 48 {
                visible = true
                halfX = max(halfX, abs(Double(left+x) + 0.5 - anchor))
                halfY = max(halfY, abs(Double(y) + 0.5 - Double(ih) / 2))
            }
        }
    }
    guard visible else { fail("Animation cell \(frame+1) is empty") }
    if !needsIsolation { scale = min(scale, Double(width) / Double(iw), Double(height) / Double(ih)) }
}
scale = min(scale, Double(width) * 0.35 / halfX, Double(height) * 0.23 / halfY)
let output = CGContext(data: nil, width: width * frames, height: height,
    bitsPerComponent: 8, bytesPerRow: width * frames * 4, space: space, bitmapInfo: info)!
output.interpolationQuality = .high
for (frame, cell) in cells.enumerated() {
    let dw = Double(cell.width) * scale, dh = Double(cell.height) * scale
    output.saveGState()
    output.clip(to: CGRect(x: frame * width, y: 0, width: width, height: height))
    let anchor = (Double(frame)+0.5) * Double(image.width) / Double(frames)
    let left = needsIsolation ? 0 : boundaries[frame]
    output.draw(cell, in: CGRect(x: Double(frame * width) + Double(width)/2 + (Double(left)-anchor)*scale,
                                y: (Double(height)-dh)/2, width: dw, height: dh))
    output.restoreGState()
}
guard let final = output.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL,
          UTType.png.identifier as CFString, 1, nil) else { fail("Cannot create PNG") }
CGImageDestinationAddImage(destination, final, nil)
guard CGImageDestinationFinalize(destination) else { fail("Cannot save PNG") }
