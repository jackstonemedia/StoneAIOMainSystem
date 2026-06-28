import sys

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove blur
content = content.replace("  // Blur logic\n  const isIdentityEmpty = !newContact.email && !newContact.firstName && !newContact.lastName;\n", "")

blur_overlay = """        {/* Overlay that blurs the rest of the form if identity is empty */}
        <div className="relative">
          {isIdentityEmpty && (
            <div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-surface/30 flex items-center justify-center rounded-[8px] border border-border/50">
              <p className="text-[13px] font-medium text-text-muted bg-surface px-4 py-2 rounded-full border border-border shadow-sm">
                Fill out primary details to unlock
              </p>
            </div>
          )}

          <div className={`space-y-6 ${isIdentityEmpty ? 'opacity-40 pointer-events-none' : ''}`}>"""

content = content.replace(blur_overlay, '        <div className="space-y-6">')

closing_divs = """          </div>
        </div>

        {/* --- Actions --- */}"""
content = content.replace(closing_divs, """        </div>

        {/* --- Actions --- */}""")

# 2. Replace tacky borders
content = content.replace("bg-surface border border-border", "bg-surface-hover border border-transparent")

with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.write(content)
