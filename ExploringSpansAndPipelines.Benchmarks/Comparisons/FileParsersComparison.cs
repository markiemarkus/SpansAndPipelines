using System.IO;
using System.Threading.Tasks;
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Engines;
using ExploringSpansAndIOPipelines.Core.Interfaces;
using ExploringSpansAndIOPipelines.Core.Parsers;
using ExploringSpansAndIOPipelines.Core.Parsers.Interfaces;

namespace ExploringSpansAndIOPipelines.Benchmarks.Comparisons
{
    [MemoryDiagnoser]
    public class FileParsersComparison
    {
        private readonly Consumer _consumer = new Consumer();
        private string _file;
        private IFileParser _fileParser;
        private IFileParser _fileParserSpans;
        private IFileParser _fileParserSpansAndPipes;
        private IFileParser _fileParserImproved;
        
        private IFileParser _syncFileParser;
        private IFileParser _syncFileParserSpans;

        [GlobalSetup]
        public void Setup()
        {
            var current = Directory.GetCurrentDirectory();
            _file = Path.Combine(current, "Assets", "BenchmarkData.psv");

            _fileParser = new FileParser(new LineParser());
            _fileParserSpans = new FileParser(new LineParserSpans());
            
            _syncFileParser = new SyncFileParser(new LineParser());
            _syncFileParserSpans = new SyncFileParser(new LineParserSpans());

            _fileParserSpansAndPipes = new FileParserSpansAndPipelines();
            _fileParserImproved = new FileParserImproved();


        }

        [Benchmark]
        public async Task FileParser()
        {
            (await _fileParser.Parse(_file)).Consume(_consumer);
        }

        [Benchmark]
        public async Task FileParserSpans()
        {
            (await _fileParserSpans.Parse(_file)).Consume(_consumer);
        }

        [Benchmark]
        public async Task FileParserSpansAndPipes()
        {
            (await _fileParserSpansAndPipes.Parse(_file)).Consume(_consumer);
        }

        [Benchmark]
        public async Task FileParserImproved()
        {
            (await _fileParserImproved.Parse(_file)).Consume(_consumer);
        }

        [Benchmark]
        public async Task SyncFileParser()
        {
            (await _syncFileParser.Parse(_file)).Consume(_consumer);
        }

        [Benchmark]
        public async Task SyncFileParserSpans()
        {
            (await _syncFileParserSpans.Parse(_file)).Consume(_consumer);
        }
    }
}