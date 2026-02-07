mod glob;
mod grep;
mod ls;
mod read;
mod types;

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <command> [args...]", args[0]);
        eprintln!("Commands:");
        eprintln!("  glob <pattern> <search>");
        eprintln!("  grep <pattern> <search> [include_glob]");
        eprintln!("  ls <path>");
        eprintln!("  read <filepath> [offset] [limit]");
        std::process::exit(1);
    }

    let command = &args[1];
    let result = match command.as_str() {
        "glob" => {
            if args.len() < 3 {
                eprintln!("Usage: {} glob <pattern> [search]", args[0]);
                std::process::exit(1);
            }
            let pattern = &args[2];
            let search = if args.len() > 3 { &args[3] } else { "." };
            glob::execute(pattern, search)
        }
        "grep" => {
            if args.len() < 3 {
                eprintln!("Usage: {} grep <pattern> <search> [include_glob]", args[0]);
                std::process::exit(1);
            }
            let pattern = &args[2];
            let search = if args.len() > 3 { &args[3] } else { "." };
            let include_glob = args.get(4).map(|s| s.as_str());
            grep::execute(pattern, search, include_glob)
        }
        "ls" => {
            if args.len() < 3 {
                eprintln!("Usage: {} ls <path>", args[0]);
                std::process::exit(1);
            }
            let ignore_patterns = if args.len() > 3 {
                args[3..].to_vec()
            } else {
                vec![
                    ".git".to_string(),
                    "node_modules".to_string(),
                    ".turbo".to_string(),
                    ".vinxi".to_string(),
                    ".vite".to_string(),
                    "dist".to_string(),
                    "target".to_string(),
                    ".next".to_string(),
                ]
            };
            ls::execute(&args[2], ignore_patterns)
        }
        "read" => {
            if args.len() < 3 {
                eprintln!("Usage: {} read <filepath> [offset] [limit]", args[0]);
                std::process::exit(1);
            }
            let filepath = &args[2];
            let offset = args.get(3).and_then(|s| s.parse().ok());
            let limit = args.get(4).and_then(|s| s.parse().ok());
            read::execute(filepath, offset, limit)
        }
        _ => {
            eprintln!("Unknown command: {}", command);
            std::process::exit(1);
        }
    };

    match result {
        Ok(output) => {
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(2);
        }
    }
}
