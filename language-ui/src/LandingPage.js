import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  BookOpen,
  Globe,
  Sparkles,
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  Languages,
  Play,
  ChevronRight,
  Star,
  Users,
  Award,
  Lightbulb,
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse position for interactive effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Floating words data
  const floatingWords = [
    { text: "Verstehen", translation: "understand", pos: "verb", delay: 0 },
    { text: "Wunderbar", translation: "wonderful", pos: "adj", delay: 0.5 },
    { text: "Lernen", translation: "learn", pos: "verb", delay: 1 },
    { text: "Sprache", translation: "language", pos: "noun", delay: 1.5 },
    { text: "Entdecken", translation: "discover", pos: "verb", delay: 2 },
    { text: "Wissen", translation: "knowledge", pos: "noun", delay: 2.5 },
    { text: "Fortschritt", translation: "progress", pos: "noun", delay: 3 },
    { text: "Erfolg", translation: "success", pos: "noun", delay: 3.5 },
    { text: "Kreativ", translation: "creative", pos: "adj", delay: 4 },
    {
      text: "Inspiration",
      translation: "inspiration",
      pos: "noun",
      delay: 4.5,
    },
    { text: "Meistern", translation: "master", pos: "verb", delay: 5 },
    { text: "Brillant", translation: "brilliant", pos: "adj", delay: 5.5 },
  ];

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description:
        "Discover word patterns using advanced embeddings and semantic analysis",
      color: "from-purple-500 to-indigo-600",
    },
    {
      icon: BookOpen,
      title: "Rich Library",
      description:
        "Access thousands of German books and texts for contextual learning",
      color: "from-blue-500 to-purple-600",
    },
    {
      icon: Globe,
      title: "Real-time Content",
      description:
        "Stay updated with live RSS feeds and current German content",
      color: "from-green-500 to-blue-600",
    },
    {
      icon: Target,
      title: "Smart Playground",
      description: "Interactive word frequency analysis and example discovery",
      color: "from-orange-500 to-red-600",
    },
  ];

  const stats = [
    { number: "50K+", label: "German Words", icon: Languages },
    { number: "1M+", label: "Sentences", icon: BookOpen },
    { number: "99%", label: "Accuracy", icon: Target },
    { number: "24/7", label: "Available", icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div
          className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            left: `${mousePosition.x * 0.1}%`,
            top: `${mousePosition.y * 0.1}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            right: `${mousePosition.x * 0.05}%`,
            bottom: `${mousePosition.y * 0.05}%`,
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            left: `${50 + mousePosition.x * 0.02}%`,
            top: `${50 + mousePosition.y * 0.02}%`,
            transform: "translate(-50%, -50%)",
            animationDelay: "2s",
          }}
        />
      </div>

      {/* Floating Words */}
      <div className="absolute inset-0 pointer-events-none">
        {floatingWords.map((word, index) => (
          <div
            key={index}
            className="absolute animate-float opacity-20 hover:opacity-60 transition-opacity duration-300"
            style={{
              left: `${10 + ((index * 8) % 80)}%`,
              top: `${20 + ((index * 12) % 60)}%`,
              animationDelay: `${word.delay}s`,
              animationDuration: `${8 + (index % 3)}s`,
            }}
          >
            <div className="text-white font-medium text-lg transform -rotate-12 hover:rotate-0 transition-transform duration-500">
              {word.text}
              <div className="text-xs opacity-60 mt-1">{word.translation}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              WortReich
            </span>
          </div>
          <button
            onClick={() => navigate("/analysis")}
            className="px-6 py-2 bg-white/10 text-white rounded-lg backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300"
          >
            Get Started
          </button>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6 backdrop-blur-sm border border-white/20">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-sm font-medium">
                  AI-Powered German Learning
                </span>
                <Star className="w-4 h-4 text-yellow-400" />
              </div>

              <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent leading-tight">
                Master German with
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                  Intelligence
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Discover the power of AI-driven language learning. Analyze word
                patterns, explore semantic relationships, and accelerate your
                German fluency.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigate("/analysis")}
                className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-purple-500/25 flex items-center justify-center gap-2"
              >
                <Brain className="w-5 h-5" />
                Start Learning
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate("/books")}
                className="group px-8 py-4 bg-white/10 text-white rounded-xl font-semibold backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Explore Library
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="text-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <stat.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white mb-1">
                    {stat.number}
                  </div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">
                Powerful Learning Tools
              </h2>
              <p className="text-xl text-gray-300">
                Everything you need to master German, powered by cutting-edge AI
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group p-6 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-500 transform hover:-translate-y-2 hover:shadow-2xl"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-200 transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pb-8">
          <button
            onClick={() => navigate("/analysis")}
            className="group inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-indigo-500/25"
          >
            <Lightbulb className="w-5 h-5" />
            Begin Your Journey
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(-12deg);
          }
          50% {
            transform: translateY(-20px) rotate(-8deg);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
