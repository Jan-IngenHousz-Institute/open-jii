"""The serving store module's locals as OpenTofu evaluates them, read with a real HCL parser."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import hcl2
from lark import Token, Tree

MAIN_TF = Path(__file__).parents[3] / "infrastructure/modules/serving-store/main.tf"

_SKIPPED = {"new_line_or_comment"}


def _children(node: Tree) -> list[Tree]:
    return [child for child in node.children if isinstance(child, Tree) and child.data not in _SKIPPED]


def _name(identifier: Tree) -> str:
    [token] = [child for child in identifier.children if isinstance(child, Token)]
    return str(token)


class ServingStoreModule:
    """main.tf's locals, evaluated for the expressions the module writes: strings and their
    interpolations, lists, objects, ``local.`` references, ``concat`` and ``for`` expressions.
    Anything else stops it, so a test never runs on a value it could not work out."""

    def __init__(self, main_tf: str):
        self._expressions: dict[str, Tree] = {}
        self._values: dict[str, Any] = {}
        for block in hcl2.parses_to_tree(main_tf).find_data("block"):
            identifier, *rest = _children(block)
            if _name(identifier) != "locals":
                continue
            [body] = [node for node in rest if node.data == "body"]
            for attribute in _children(body):
                name, expression = _children(attribute)
                self._expressions[_name(name)] = expression

    @classmethod
    def read(cls) -> ServingStoreModule:
        return cls(MAIN_TF.read_text())

    def local(self, name: str) -> Any:
        if name not in self._values:
            self._values[name] = self._evaluate(self._expressions[name], {})
        return self._values[name]

    def local_list(self, name: str) -> list[str]:
        return list(self.local(name))

    def grants(self, role: str) -> list[str]:
        """A store user's grants as the module writes them into users.xml, in order."""
        return list(self.local("users")[role]["grants"])

    def _evaluate(self, node: Tree, scope: dict[str, Any]) -> Any:
        children = _children(node)
        match node.data:
            case "expr_term":
                return self._evaluate(children[0], scope)
            case "string":
                return "".join(self._string_part(part, scope) for part in children)
            case "tuple":
                return [self._evaluate(item, scope) for item in children]
            case "object":
                return {
                    self._key(key): self._evaluate(value, scope)
                    for key, value in (_children(element) for element in children)
                }
            case "identifier":
                return scope[_name(node)]
            case "get_attr_expr_term":
                base, attribute = children
                [attribute_name] = _children(attribute)
                if _children(base)[0].data == "identifier" and _name(_children(base)[0]) == "local":
                    return self.local(_name(attribute_name))
                return self._evaluate(base, scope)[_name(attribute_name)]
            case "function_call":
                function, *arguments = children
                if _name(function) != "concat":
                    raise ValueError(f"main.tf calls {_name(function)}, which this reader cannot evaluate")
                values = [
                    self._evaluate(argument, scope) for group in arguments for argument in _children(group)
                ]
                return [item for value in values for item in value]
            case "for_tuple_expr":
                intro, body = children
                variable, items = self._for_intro(intro, scope)
                return [self._evaluate(body, {**scope, variable: item}) for item in items]
            case "for_object_expr":
                intro, key, value = children
                variable, items = self._for_intro(intro, scope)
                return {
                    self._evaluate(key, {**scope, variable: item}): self._evaluate(
                        value, {**scope, variable: item}
                    )
                    for item in items
                }
        raise ValueError(f"main.tf writes a {node.data}, which this reader cannot evaluate")

    def _string_part(self, part: Tree, scope: dict[str, Any]) -> str:
        [content] = part.children
        if isinstance(content, Token):
            return str(content)
        [expression] = _children(content)
        return str(self._evaluate(expression, scope))

    def _key(self, key: Tree) -> str:
        [term] = _children(key)
        [inner] = _children(term)
        return _name(inner) if inner.data == "identifier" else self._evaluate(inner, {})

    def _for_intro(self, intro: Tree, scope: dict[str, Any]) -> tuple[str, list[Any]]:
        identifier, items = _children(intro)
        return _name(identifier), self._evaluate(items, scope)
