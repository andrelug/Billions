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
// Keep one body scale for the entire strip; align the planted feet in every pose.
struct Pose {
    let pixels: [UInt8]
    let w: Int
    let h: Int
    let cx: Double
    let bottom: Int
    let bodyHeight: Int
    let halfWidth: Double
}
var poses: [Pose] = []
for frame in 0..<frames {
    let left = needsIsolation ? 0 : boundaries[frame]
    let right = needsIsolation ? image.width : boundaries[frame+1]
    guard let cell = needsIsolation ? isolated[frame] : image.cropping(to:CGRect(x:left,y:0,width:right-left,height:image.height)) else { fail("Cannot read animation cell") }
    let iw=cell.width, ih=cell.height
    var pixels=[UInt8](repeating:0,count:iw*ih*4)
    pixels.withUnsafeMutableBytes { b in
        let c=CGContext(data:b.baseAddress,width:iw,height:ih,bitsPerComponent:8,bytesPerRow:iw*4,space:space,bitmapInfo:info)!
        c.draw(cell,in:CGRect(x:0,y:0,width:iw,height:ih))
    }
    var top=ih, bottom=0, x0=iw, x1=0
    for y in 0..<ih { for x in 0..<iw where pixels[(y*iw+x)*4+3]>40 {
        top=min(top,y); bottom=max(bottom,y+1); x0=min(x0,x); x1=max(x1,x+1)
    } }
    guard bottom>top else { fail("Animation cell \(frame+1) is empty") }
    var sx=0.0,n=0.0
    for y in max(top,bottom-(bottom-top)/5)..<bottom { for x in x0..<x1 where pixels[(y*iw+x)*4+3]>40 { sx+=Double(x)+0.5; n+=1 } }
    let cx=n>0 ? sx/n : Double(x0+x1)/2
    poses.append(Pose(pixels:pixels,w:iw,h:ih,cx:cx,bottom:bottom,bodyHeight:bottom-top,halfWidth:max(cx-Double(x0),Double(x1)-cx)))
}
let maxHeight=poses.map{$0.bodyHeight}.max()!, maxHalfWidth=poses.map{$0.halfWidth}.max()!
let scale=min(Double(height)*0.75/Double(maxHeight),Double(width)*0.45/max(1,maxHalfWidth))
let outWidth=width*frames
var pixels=[UInt8](repeating:0,count:outWidth*height*4)
for (frame,p) in poses.enumerated() {
    for y in 0..<height { for x in 0..<width {
        let px=(Double(x)+0.5-Double(width)*0.5)/scale+p.cx-0.5
        let py=(Double(y)+0.5-Double(height)*0.9)/scale+Double(p.bottom)-0.5
        let x0=Int(floor(px)),y0=Int(floor(py)),dx=px-Double(x0),dy=py-Double(y0)
        for channel in 0..<4 {
            var value=0.0
            for yy in 0...1 { for xx in 0...1 {
                let ix=x0+xx,iy=y0+yy
                if ix>=0 && ix<p.w && iy>=0 && iy<p.h {
                    value += Double(p.pixels[(iy*p.w+ix)*4+channel]) * (xx==0 ? 1-dx : dx) * (yy==0 ? 1-dy : dy)
                }
            } }
            pixels[(y*outWidth+frame*width+x)*4+channel]=UInt8(max(0,min(255,value.rounded())))
        }
    } }
}
let final=pixels.withUnsafeMutableBytes { b -> CGImage in
    CGContext(data:b.baseAddress,width:outWidth,height:height,bitsPerComponent:8,bytesPerRow:outWidth*4,space:space,bitmapInfo:info)!.makeImage()!
}
guard let destination=CGImageDestinationCreateWithURL(URL(fileURLWithPath:args[2]) as CFURL,UTType.png.identifier as CFString,1,nil) else { fail("Cannot create PNG") }
CGImageDestinationAddImage(destination,final,nil)
guard CGImageDestinationFinalize(destination) else { fail("Cannot save PNG") }
