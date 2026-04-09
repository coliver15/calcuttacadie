// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CacuttaApp",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "CacuttaApp",
            targets: ["CacuttaApp"]
        ),
    ],
    dependencies: [
        .package(
            url: "https://github.com/supabase/supabase-swift",
            from: "2.0.0"
        ),
    ],
    targets: [
        .target(
            name: "CacuttaApp",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "Sources/CacuttaApp"
        ),
    ]
)
