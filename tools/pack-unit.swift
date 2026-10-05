// Mechanical export: fit the body to 75% height and feet to (50%, 90%).
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let args = CommandLine.arguments
guard args.count == 5, let width = Int(args[3]), let height = Int(args[4]), width > 0, height > 0,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Usage: pack-unit source.png output.png width height") }
let iw=image.width, ih=image.height, space=CGColorSpaceCreateDeviceRGB()
let info=CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
var pixels=[UInt8](repeating:0,count:iw*ih*4)
pixels.withUnsafeMutableBytes { b in
    let c=CGContext(data:b.baseAddress,width:iw,height:ih,bitsPerComponent:8,bytesPerRow:iw*4,space:space,bitmapInfo:info)!
    c.draw(image,in:CGRect(x:0,y:0,width:iw,height:ih))
}
var top=ih, bottom=0, left=iw, right=0
for y in 0..<ih { for x in 0..<iw where pixels[(y*iw+x)*4+3]>40 {
    top=min(top,y); bottom=max(bottom,y+1); left=min(left,x); right=max(right,x+1)
} }
guard bottom>top else { fatalError("Character has no visible body") }
var sx=0.0, count=0.0
for y in max(top, bottom-(bottom-top)/5)..<bottom { for x in left..<right where pixels[(y*iw+x)*4+3]>40 { sx+=Double(x)+0.5; count+=1 } }
let cx=count>0 ? sx/count : Double(left+right)/2
let halfX=max(cx-Double(left),Double(right)-cx)
let scale=min(Double(height)*0.75/Double(bottom-top),Double(width)*0.45/max(1,halfX))
guard scale*Double(bottom-top)/Double(height)>=0.68 else { fatalError("Pose is too wide for the requested body framing; regenerate with bent arms or a compact weapon pose") }
var outputPixels=[UInt8](repeating:0,count:width*height*4)
for y in 0..<height { for x in 0..<width {
    let px=(Double(x)+0.5-Double(width)*0.5)/scale+cx-0.5
    let py=(Double(y)+0.5-Double(height)*0.9)/scale+Double(bottom)-0.5
    let x0=Int(floor(px)), y0=Int(floor(py)), dx=px-Double(x0), dy=py-Double(y0)
    for channel in 0..<4 {
        var v=0.0
        for yy in 0...1 { for xx in 0...1 {
            let ix=x0+xx, iy=y0+yy
            if ix>=0 && ix<iw && iy>=0 && iy<ih {
                v += Double(pixels[(iy*iw+ix)*4+channel]) * (xx==0 ? 1-dx : dx) * (yy==0 ? 1-dy : dy)
            }
        } }
        outputPixels[(y*width+x)*4+channel]=UInt8(max(0,min(255,v.rounded())))
    }
} }
let final=outputPixels.withUnsafeMutableBytes { b -> CGImage in
    CGContext(data:b.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:info)!.makeImage()!
}
guard let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:args[2]) as CFURL,UTType.png.identifier as CFString,1,nil) else { fatalError("Cannot create PNG") }
CGImageDestinationAddImage(dest,final,nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Cannot save PNG") }
