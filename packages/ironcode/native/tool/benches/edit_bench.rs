use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use ironcode_tool::edit::replace;

fn generate_test_content(lines: usize) -> String {
    let mut content = String::new();
    for i in 0..lines {
        content.push_str(&format!("    function test{}() {{\n", i));
        content.push_str("        console.log('hello');\n");
        content.push_str("        return 42;\n");
        content.push_str("    }\n");
    }
    content
}

fn bench_simple_replace(c: &mut Criterion) {
    let content = "Hello world, this is a test";

    c.bench_function("simple_replace_small", |b| {
        b.iter(|| {
            replace(
                black_box(content),
                black_box("world"),
                black_box("Rust"),
                black_box(false),
            )
        })
    });
}

fn bench_line_trimmed_replace(c: &mut Criterion) {
    let content = "    hello world\n    foo bar\n    test case";

    c.bench_function("line_trimmed_replace", |b| {
        b.iter(|| {
            replace(
                black_box(content),
                black_box("hello world\nfoo bar"),
                black_box("goodbye\nnew line"),
                black_box(false),
            )
        })
    });
}

fn bench_block_anchor_replace(c: &mut Criterion) {
    let content = generate_test_content(100);
    let find = "function test50() {\n        console.log('hello');\n        return 42;\n    }";
    let replace_with =
        "function test50() {\n        console.log('goodbye');\n        return 100;\n    }";

    c.bench_function("block_anchor_replace_medium", |b| {
        b.iter(|| {
            replace(
                black_box(&content),
                black_box(find),
                black_box(replace_with),
                black_box(false),
            )
        })
    });
}

fn bench_replace_with_file_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("replace_by_size");

    for size in [10, 100, 1000, 5000].iter() {
        let content = generate_test_content(*size);
        let find = "console.log('hello');";
        let replace_with = "console.log('goodbye');";

        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_lines", size)),
            size,
            |b, _| {
                b.iter(|| {
                    replace(
                        black_box(&content),
                        black_box(find),
                        black_box(replace_with),
                        black_box(false),
                    )
                })
            },
        );
    }

    group.finish();
}

fn bench_replace_all(c: &mut Criterion) {
    let content = "foo bar foo baz foo qux foo";

    c.bench_function("replace_all", |b| {
        b.iter(|| {
            replace(
                black_box(content),
                black_box("foo"),
                black_box("REPLACED"),
                black_box(true),
            )
        })
    });
}

fn bench_whitespace_normalized(c: &mut Criterion) {
    let content = "hello     world\n    with   lots  of    spaces";

    c.bench_function("whitespace_normalized", |b| {
        b.iter(|| {
            replace(
                black_box(content),
                black_box("hello world"),
                black_box("goodbye world"),
                black_box(false),
            )
        })
    });
}

fn bench_levenshtein_similarity(c: &mut Criterion) {
    // This tests BlockAnchorReplacer which uses Levenshtein
    let content = "function test() {\n    console.log('helo');\n    return 42;\n}";
    let find = "function test() {\n    console.log('hello');\n    return 42;\n}";
    let replace_with = "function test() {\n    console.log('goodbye');\n    return 100;\n}";

    c.bench_function("levenshtein_similarity", |b| {
        b.iter(|| {
            replace(
                black_box(content),
                black_box(find),
                black_box(replace_with),
                black_box(false),
            )
        })
    });
}

criterion_group!(
    benches,
    bench_simple_replace,
    bench_line_trimmed_replace,
    bench_block_anchor_replace,
    bench_replace_with_file_sizes,
    bench_replace_all,
    bench_whitespace_normalized,
    bench_levenshtein_similarity,
);

criterion_main!(benches);
