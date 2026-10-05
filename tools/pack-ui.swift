// Mechanical UI export: resize height uniformly and stretch only the middle
// horizontally, keeping corner rivets/gears round even for very wide HUD bars.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let args=CommandLine.arguments
guard args.count==7,let width=Int(args[3]),let height=Int(args[4]),let left=Double(args[5]),let right=Double(args[6]),
      let source=CGImageSourceCreateWithURL(URL(fileURLWithPath:args[1]) as CFURL,nil),
      let image=CGImageSourceCreateImageAtIndex(source,0,nil) else { fatalError("Usage: pack-ui source output width height left-slice right-slice") }
let iw=image.width,ih=image.height,scale=Double(height)/Double(ih)
let sl=left/scale,sr=right/scale
guard left+right<Double(width),sl+sr<Double(iw) else { fatalError("Source canvas is too narrow to preserve UI corners") }
let space=CGColorSpaceCreateDeviceRGB()
let info=CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
var input=[UInt8](repeating:0,count:iw*ih*4)
input.withUnsafeMutableBytes { b in
    CGContext(data:b.baseAddress,width:iw,height:ih,bitsPerComponent:8,bytesPerRow:iw*4,space:space,bitmapInfo:info)!.draw(image,in:CGRect(x:0,y:0,width:iw,height:ih))
}
var output=[UInt8](repeating:0,count:width*height*4)
for y in 0..<height { for x in 0..<width {
    let xx=Double(x)+0.5
    let mappedX=xx<left ? xx/scale : xx>=Double(width)-right ? Double(iw)-(Double(width)-xx)/scale : sl+(xx-left)*(Double(iw)-sl-sr)/(Double(width)-left-right)
    let px=mappedX-0.5,py=(Double(y)+0.5)/scale-0.5
    let x0=Int(floor(px)),y0=Int(floor(py)),dx=px-Double(x0),dy=py-Double(y0)
    for channel in 0..<4 {
        var v=0.0
        for yy in 0...1 { for xx in 0...1 {
            let ix=max(0,min(iw-1,x0+xx)),iy=max(0,min(ih-1,y0+yy))
            v += Double(input[(iy*iw+ix)*4+channel]) * (xx==0 ? 1-dx : dx) * (yy==0 ? 1-dy : dy)
        } }
        output[(y*width+x)*4+channel]=UInt8(max(0,min(255,v.rounded())))
    }
} }
let final=output.withUnsafeMutableBytes { b -> CGImage in
    CGContext(data:b.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:info)!.makeImage()!
}
guard let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:args[2]) as CFURL,UTType.png.identifier as CFString,1,nil) else { fatalError("Cannot create PNG") }
CGImageDestinationAddImage(dest,final,nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Cannot save PNG") }
