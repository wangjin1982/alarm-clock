fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("native/location_bridge.m")
            .flag("-fobjc-arc")
            .compile("location_bridge");

        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=CoreLocation");
    }

    tauri_build::build()
}
