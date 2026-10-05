// Mechanical canvas export: retain the artwork and move its visible base to y=height.
// Input has already been resized to its delivery dimensions; no pixels are repainted.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let args=CommandLine.arguments
guard args.count==3,
      let source=CGImageSourceCreateWithURL(URL(fileURLWithPath:args[1]) as CFURL,nil),
      let image=CGImageSourceCreateImageAtIndex(source,0,nil) else { fatalError("Usage: anchor-object input.png output.png") }
let w=image.width,h=image.height,space=CGColorSpaceCreateDeviceRGB()
let info=CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
var pixels=[UInt8](repeating:0,count:w*h*4)
pixels.withUnsafeMutableBytes { b in
    CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:info)!.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
}
var bottom=0
for y in 0..<h { for x in 0..<w where pixels[(y*w+x)*4+3]>40 { bottom=max(bottom,y+1) } }
guard bottom>0 else { fatalError("Object has no visible pixels") }
let shift=h-bottom
var output=[UInt8](repeating:0,count:w*h*4)
for y in shift..<h { for x in 0..<w { for c in 0..<4 {
    output[(y*w+x)*4+c]=pixels[((y-shift)*w+x)*4+c]
} } }
let final=output.withUnsafeMutableBytes { b in
    CGContext(data:b.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:info)!.makeImage()!
}
guard let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:args[2]) as CFURL,UTType.png.identifier as CFString,1,nil) else { fatalError("Cannot create PNG") }
CGImageDestinationAddImage(dest,final,nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Cannot save PNG") }
